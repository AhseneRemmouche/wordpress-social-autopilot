import { randomBytes } from "node:crypto";

import type { Platform } from "@prisma/client";

import { env } from "@/lib/env";
import { getOAuthConfig } from "@/lib/oauth/config";
import { STATE_COOKIE, VERIFIER_COOKIE, serializeOAuthCookie } from "@/lib/oauth/cookies";
import { parsePlatformSlug, platformSlug } from "@/lib/oauth/platform";
import { generatePkcePair } from "@/lib/oauth/pkce";
import { requireOwner } from "@/lib/oauth/session";

// Uses node:crypto and env — Node runtime only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth start (FR-017, contracts/oauth.md). Owner-only. Generates a CSRF `state`
 * (and, for PKCE providers, a `code_verifier`), stashes them in short-lived
 * HTTP-only cookies, and 302-redirects to the provider authorize URL with the
 * platform's scopes.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ platform: string }> },
): Promise<Response> {
  if (!(await requireOwner(request))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { platform: slug } = await context.params;
  const platform = parsePlatformSlug(slug);
  if (!platform) {
    return new Response(JSON.stringify({ error: "unknown platform" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const config = getOAuthConfig(platform);
  const state = randomBytes(16).toString("base64url");
  const redirectUri = `${env.APP_BASE_URL}/api/oauth/${platformSlug(platform)}/callback`;

  const authorize = new URL(config.authUrl);
  authorize.searchParams.set("response_type", "code");
  // TikTok's authorize endpoint uses `client_key` + comma-delimited scopes; the
  // other providers use `client_id` + space-delimited scopes.
  authorize.searchParams.set(
    config.provider === "TIKTOK" ? "client_key" : "client_id",
    clientIdFor(platform),
  );
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set(
    "scope",
    config.scopes.join(config.provider === "TIKTOK" ? "," : " "),
  );
  authorize.searchParams.set("state", state);
  // Google only returns a refresh token with offline access + forced consent.
  if (config.provider === "GOOGLE") {
    authorize.searchParams.set("access_type", "offline");
    authorize.searchParams.set("prompt", "consent");
  }

  const headers = new Headers({ Location: authorize.toString() });
  headers.append("Set-Cookie", serializeOAuthCookie(STATE_COOKIE, state));

  if (config.usesPkce) {
    const pkce = generatePkcePair();
    authorize.searchParams.set("code_challenge", pkce.codeChallenge);
    authorize.searchParams.set("code_challenge_method", pkce.codeChallengeMethod);
    // Re-set Location after adding the PKCE params.
    headers.set("Location", authorize.toString());
    headers.append("Set-Cookie", serializeOAuthCookie(VERIFIER_COOKIE, pkce.codeVerifier));
  }

  return new Response(null, { status: 302, headers });
}

/** The public OAuth client id/key for a platform's provider. */
function clientIdFor(platform: Platform): string {
  const provider = getOAuthConfig(platform).provider;
  switch (provider) {
    case "LINKEDIN":
      return env.LINKEDIN_CLIENT_ID;
    case "META":
      return env.META_APP_ID;
    case "X":
      return env.X_CLIENT_ID;
    case "TIKTOK":
      return env.TIKTOK_CLIENT_KEY;
    case "GOOGLE":
      return env.GOOGLE_CLIENT_ID;
  }
}
