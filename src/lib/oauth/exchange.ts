import type { Platform } from "@prisma/client";

import { env } from "@/lib/env";
import {
  OAUTH_CONFIGS,
  type OAuthProvider,
  PLATFORM_PROVIDER,
} from "@/lib/oauth/config";

/**
 * Authorization-code → token exchange (FR-017/018/019, contracts/oauth.md, plan §6).
 *
 * Given an authorization `code` (and, for PKCE providers, the `codeVerifier`),
 * exchange it at the provider token endpoint and return a NORMALIZED result the
 * callback route can encrypt and persist. Provider-specific quirks handled here:
 *   - LinkedIn: resolve the member URN via /userinfo (publisher `author`).
 *   - Meta: short-lived → long-lived token, then resolve `fbPageId` (Facebook)
 *     or `igUserId` (Instagram) and store the Page access token.
 *   - X / TikTok: PKCE + rotating refresh tokens; capture `open_id` for TikTok.
 *   - Google/YouTube: connect-only, offline refresh token.
 *
 * Errors carry only provider + HTTP status — never a token or secret (Principle II).
 */

export interface ExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date | null;
  scope?: string;
  externalAccountId?: string;
  fbPageId?: string;
  igUserId?: string;
}

export class OAuthExchangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthExchangeError";
  }
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  open_id?: string;
}

/** A token response validated to carry a non-empty access token. */
type ValidTokenResponse = TokenResponse & { access_token: string };

function providerCredentials(provider: OAuthProvider): {
  clientId: string;
  clientSecret: string;
} {
  switch (provider) {
    case "LINKEDIN":
      return { clientId: env.LINKEDIN_CLIENT_ID, clientSecret: env.LINKEDIN_CLIENT_SECRET };
    case "META":
      return { clientId: env.META_APP_ID, clientSecret: env.META_APP_SECRET };
    case "X":
      return { clientId: env.X_CLIENT_ID, clientSecret: env.X_CLIENT_SECRET };
    case "TIKTOK":
      return { clientId: env.TIKTOK_CLIENT_KEY, clientSecret: env.TIKTOK_CLIENT_SECRET };
    case "GOOGLE":
      return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  }
}

function expiresAtFrom(expiresIn: number | undefined): Date | null {
  return typeof expiresIn === "number" ? new Date(Date.now() + expiresIn * 1000) : null;
}

/** Build the token-exchange request for the standard authorization_code grant. */
function tokenRequestInit(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
  codeVerifier: string | undefined,
  creds: { clientId: string; clientSecret: string },
): RequestInit {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (codeVerifier) params.set("code_verifier", codeVerifier);

  if (provider === "X") {
    // Confidential client: HTTP Basic auth; client_id also required in the body.
    params.set("client_id", creds.clientId);
    headers.Authorization =
      "Basic " + Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  } else if (provider === "TIKTOK") {
    params.set("client_key", creds.clientId);
    params.set("client_secret", creds.clientSecret);
  } else {
    params.set("client_id", creds.clientId);
    params.set("client_secret", creds.clientSecret);
  }

  return { method: "POST", headers, body: params };
}

async function readToken(res: Response, provider: OAuthProvider): Promise<ValidTokenResponse> {
  if (!res.ok) {
    throw new OAuthExchangeError(`${provider} token exchange failed (HTTP ${res.status})`);
  }
  const data = (await res.json()) as TokenResponse;
  if (!data.access_token) {
    throw new OAuthExchangeError(`${provider} token exchange returned no access token`);
  }
  return { ...data, access_token: data.access_token };
}

/** LinkedIn: resolve the member URN (used as the publish author). */
async function resolveLinkedInUrn(accessToken: string): Promise<string | undefined> {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined; // non-fatal: connection still succeeds
  const info = (await res.json()) as { sub?: string };
  return info.sub ? `urn:li:person:${info.sub}` : undefined;
}

/** Meta: short-lived → long-lived, then resolve the target Page/IG account. */
async function exchangeMeta(
  platform: Platform,
  shortLived: ValidTokenResponse,
  creds: { clientId: string; clientSecret: string },
): Promise<ExchangeResult> {
  const longRes = await fetch(
    "https://graph.facebook.com/v25.0/oauth/access_token?" +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        fb_exchange_token: shortLived.access_token,
      }),
  );
  const longLived = await readToken(longRes, "META");
  const userToken = longLived.access_token;

  // Resolve the first managed Page (single-owner assumption).
  const pagesRes = await fetch(
    "https://graph.facebook.com/v25.0/me/accounts?" +
      new URLSearchParams({ access_token: userToken }),
  );
  if (!pagesRes.ok) {
    throw new OAuthExchangeError(`META page lookup failed (HTTP ${pagesRes.status})`);
  }
  const pages = (await pagesRes.json()) as {
    data?: Array<{ id?: string; access_token?: string }>;
  };
  const page = pages.data?.[0];
  if (!page?.id || !page.access_token) {
    throw new OAuthExchangeError("META account has no publishable Page");
  }

  const base: ExchangeResult = {
    // Page access token is what publishing uses; it is long-lived (no refresh).
    accessToken: page.access_token,
    expiresAt: expiresAtFrom(longLived.expires_in),
    scope: longLived.scope ?? shortLived.scope,
    externalAccountId: page.id,
    fbPageId: page.id,
  };

  if (platform === "FACEBOOK") return base;

  // Instagram: resolve the IG business account bound to the Page.
  const igRes = await fetch(
    `https://graph.facebook.com/v25.0/${page.id}?` +
      new URLSearchParams({
        fields: "instagram_business_account",
        access_token: page.access_token,
      }),
  );
  if (!igRes.ok) {
    throw new OAuthExchangeError(`META IG lookup failed (HTTP ${igRes.status})`);
  }
  const ig = (await igRes.json()) as {
    instagram_business_account?: { id?: string };
  };
  const igUserId = ig.instagram_business_account?.id;
  if (!igUserId) {
    throw new OAuthExchangeError("No Instagram business account linked to the Page");
  }
  return { ...base, igUserId };
}

export interface ExchangeParams {
  platform: Platform;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}

export async function exchangeCode(params: ExchangeParams): Promise<ExchangeResult> {
  const { platform, code, redirectUri, codeVerifier } = params;
  const provider = PLATFORM_PROVIDER[platform];
  const creds = providerCredentials(provider);
  const config = OAUTH_CONFIGS[provider];

  let requestInit: RequestInit;
  let tokenUrl = config.tokenUrl;

  if (provider === "META") {
    // Meta uses a GET exchange with query params.
    tokenUrl =
      config.tokenUrl +
      "?" +
      new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: redirectUri,
        code,
      });
    requestInit = { method: "GET" };
  } else {
    requestInit = tokenRequestInit(provider, code, redirectUri, codeVerifier, creds);
  }

  const res = await fetch(tokenUrl, requestInit);
  const token = await readToken(res, provider);

  if (provider === "META") {
    return exchangeMeta(platform, token, creds);
  }

  const result: ExchangeResult = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: expiresAtFrom(token.expires_in),
    scope: token.scope,
  };

  if (provider === "LINKEDIN") {
    result.externalAccountId = await resolveLinkedInUrn(token.access_token);
  } else if (provider === "TIKTOK") {
    result.externalAccountId = token.open_id;
  }

  return result;
}
