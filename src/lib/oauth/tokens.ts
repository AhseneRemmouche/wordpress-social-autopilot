import type { PlatformAccount } from "@prisma/client";

import { decrypt, encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import {
  OAUTH_CONFIGS,
  type OAuthProvider,
  PLATFORM_PROVIDER,
  providerSupportsRefresh,
} from "@/lib/oauth/config";
import { prisma } from "@/lib/prisma";

/**
 * OAuth access-token management for publishers (FR-019/FR-020, plan §6).
 *
 * `getValidAccessToken(account)` decrypts the stored token and, when it is
 * near/past expiry and the provider supports refresh, performs the refresh grant
 * — re-encrypting and persisting the rotated refresh token (X and TikTok rotate;
 * Google does not) and returning a fresh access token. When refresh is
 * unsupported or fails, the account is marked TOKEN_EXPIRED so the dashboard
 * surfaces a reconnect need.
 *
 * Note: these take the already-loaded `PlatformAccount` (the worker holds it),
 * refining plan §6's `(platform)` signature to avoid a redundant DB read.
 *
 * Security (Principle II): tokens are never logged; errors carry only the
 * platform name and HTTP status.
 */

export class TokenError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TokenError";
  }
}

/** Refresh a token this many ms before its stated expiry. */
const EXPIRY_BUFFER_MS = 60_000;

/** Providers that issue a usable refresh token (LinkedIn/Meta require reconnect). */
const supportsRefresh = providerSupportsRefresh;

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

interface RefreshResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

/** Build the provider-specific refresh-grant request (secrets stay in body/header). */
function refreshRequestInit(
  provider: OAuthProvider,
  refreshToken: string,
  creds: { clientId: string; clientSecret: string },
): RequestInit {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (provider === "X") {
    // Confidential client: HTTP Basic auth with client_id:client_secret.
    params.set("client_id", creds.clientId);
    headers.Authorization =
      "Basic " + Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  } else if (provider === "TIKTOK") {
    params.set("client_key", creds.clientId);
    params.set("client_secret", creds.clientSecret);
  } else {
    // GOOGLE (and any other credentialed provider).
    params.set("client_id", creds.clientId);
    params.set("client_secret", creds.clientSecret);
  }

  return { method: "POST", headers, body: params };
}

/** Best-effort: flag the account so the dashboard prompts a reconnect. */
async function markExpired(platform: PlatformAccount["platform"]): Promise<void> {
  try {
    await prisma.platformAccount.update({
      where: { platform },
      data: { status: "TOKEN_EXPIRED" },
    });
  } catch {
    // The reconnect signal is best-effort; never mask the original error.
  }
}

/**
 * Force a refresh of the account's access token: POST the refresh grant,
 * re-encrypt + persist the rotated tokens, return the new access token. On any
 * failure the account is marked TOKEN_EXPIRED and a TokenError is thrown.
 */
export async function refreshAccessToken(account: PlatformAccount): Promise<string> {
  const provider = PLATFORM_PROVIDER[account.platform];

  if (!supportsRefresh(provider) || !account.refreshToken) {
    await markExpired(account.platform);
    throw new TokenError(`${account.platform} requires reconnect (refresh unavailable)`);
  }

  const creds = providerCredentials(provider);
  const tokenUrl = OAUTH_CONFIGS[provider].tokenUrl;

  let refreshToken: string;
  try {
    refreshToken = decrypt(account.refreshToken);
  } catch {
    await markExpired(account.platform);
    throw new TokenError(`${account.platform} refresh token is unreadable; reconnect required`);
  }

  const res = await fetch(tokenUrl, refreshRequestInit(provider, refreshToken, creds));
  if (!res.ok) {
    await markExpired(account.platform);
    throw new TokenError(`${account.platform} token refresh failed (HTTP ${res.status})`);
  }

  const data = (await res.json()) as RefreshResponse;
  if (!data.access_token) {
    await markExpired(account.platform);
    throw new TokenError(`${account.platform} token refresh returned no access token`);
  }

  const expiresAt =
    typeof data.expires_in === "number"
      ? new Date(Date.now() + data.expires_in * 1000)
      : null;

  await prisma.platformAccount.update({
    where: { platform: account.platform },
    data: {
      accessToken: encrypt(data.access_token),
      expiresAt,
      status: "CONNECTED",
      // Rotate only when the provider returns a new refresh token (X/TikTok do).
      ...(data.refresh_token ? { refreshToken: encrypt(data.refresh_token) } : {}),
    },
  });

  return data.access_token;
}

/**
 * Return a currently-valid access token for the account, refreshing proactively
 * when it is near/past expiry and the provider supports refresh.
 */
export async function getValidAccessToken(account: PlatformAccount): Promise<string> {
  if (!account.accessToken) {
    throw new TokenError(`No access token stored for ${account.platform}`);
  }

  const provider = PLATFORM_PROVIDER[account.platform];
  const nearExpiry =
    account.expiresAt !== null &&
    account.expiresAt.getTime() - Date.now() < EXPIRY_BUFFER_MS;

  if (nearExpiry && supportsRefresh(provider) && account.refreshToken) {
    return refreshAccessToken(account);
  }

  return decrypt(account.accessToken);
}
