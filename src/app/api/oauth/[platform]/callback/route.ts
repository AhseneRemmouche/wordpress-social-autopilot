import type { Platform } from "@prisma/client";

import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import {
  STATE_COOKIE,
  VERIFIER_COOKIE,
  clearOAuthCookie,
  readCookie,
} from "@/lib/oauth/cookies";
import { exchangeCode } from "@/lib/oauth/exchange";
import { parsePlatformSlug, platformSlug } from "@/lib/oauth/platform";
import { prisma } from "@/lib/prisma";

// Uses node:crypto (encrypt) + prisma — Node runtime only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth callback (FR-017/018, contracts/oauth.md). Validates the CSRF `state`
 * cookie, exchanges the `code` (PKCE verifier for X/TikTok), encrypts the tokens
 * (AES-256-GCM), and upserts the PlatformAccount as CONNECTED. On any failure it
 * redirects back to /connections with a secret-free `error` query.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ platform: string }> },
): Promise<Response> {
  const { platform: slug } = await context.params;
  const platform = parsePlatformSlug(slug);
  if (!platform) {
    return redirect("/connections?error=unknown_platform");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  if (providerError) {
    return redirect(`/connections?error=${encodeURIComponent(providerError)}`);
  }

  // --- Validate CSRF state (must match the cookie set at start) — 400 on mismatch. ---
  const expectedState = readCookie(request, STATE_COOKIE);
  if (!state || !expectedState || state !== expectedState) {
    return new Response(JSON.stringify({ error: "invalid state" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (!code) {
    return redirect("/connections?error=missing_code");
  }

  const codeVerifier = readCookie(request, VERIFIER_COOKIE);
  const redirectUri = `${env.APP_BASE_URL}/api/oauth/${platformSlug(platform)}/callback`;

  try {
    const tokens = await exchangeCode({ platform, code, redirectUri, codeVerifier });
    await persistAccount(platform, tokens);
  } catch {
    // Message is intentionally generic; details are never surfaced to the browser.
    return redirect("/connections?error=connection_failed", true);
  }

  return redirect("/connections?connected=" + platformSlug(platform), true);
}

async function persistAccount(
  platform: Platform,
  tokens: Awaited<ReturnType<typeof exchangeCode>>,
): Promise<void> {
  const data = {
    status: "CONNECTED" as const,
    accessToken: encrypt(tokens.accessToken),
    refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    expiresAt: tokens.expiresAt ?? null,
    scope: tokens.scope ?? null,
    externalAccountId: tokens.externalAccountId ?? null,
    fbPageId: tokens.fbPageId ?? null,
    igUserId: tokens.igUserId ?? null,
    connectedAt: new Date(),
  };

  await prisma.platformAccount.upsert({
    where: { platform },
    create: { platform, ...data },
    update: data,
  });
}

/** Build a redirect to a dashboard path, clearing the OAuth cookies. */
function redirect(path: string, clearCookies = false): Response {
  const headers = new Headers({ Location: `${env.APP_BASE_URL}${path}` });
  if (clearCookies) {
    headers.append("Set-Cookie", clearOAuthCookie(STATE_COOKIE));
    headers.append("Set-Cookie", clearOAuthCookie(VERIFIER_COOKIE));
  }
  return new Response(null, { status: 302, headers });
}
