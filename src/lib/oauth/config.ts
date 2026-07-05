import type { Platform } from "@prisma/client";

/**
 * Per-provider OAuth configuration (FR-017, plan §6). Authorize/token URLs,
 * scopes, and PKCE requirement, confirmed against official docs in research.md
 * and re-verified for this module.
 *
 * There are five *providers* rather than six platforms: Meta covers both
 * Facebook and Instagram (one Meta login grants Page + IG publishing), and
 * Google covers YouTube. `getOAuthConfig(platform)` resolves via PLATFORM_PROVIDER.
 */

export type OAuthProvider = "LINKEDIN" | "META" | "X" | "TIKTOK" | "GOOGLE";

export interface OAuthConfig {
  provider: OAuthProvider;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Whether the authorization-code exchange requires PKCE (code_verifier/challenge). */
  usesPkce: boolean;
}

export const PLATFORM_PROVIDER: Record<Platform, OAuthProvider> = {
  LINKEDIN: "LINKEDIN",
  FACEBOOK: "META",
  INSTAGRAM: "META",
  X: "X",
  TIKTOK: "TIKTOK",
  YOUTUBE: "GOOGLE",
};

/**
 * Providers that issue a usable refresh token, so the app renews their
 * (short-lived) access tokens automatically instead of ever needing a manual
 * reconnect. LinkedIn and Meta don't refresh — their long-lived tokens expire
 * (~60 days) and require reconnect. Single source of truth for both the token
 * refresh logic (`tokens.ts`) and the "Auto-renews" connections UI.
 */
const REFRESH_PROVIDERS: ReadonlySet<OAuthProvider> = new Set(["X", "TIKTOK", "GOOGLE"]);

/** Whether a provider's tokens auto-renew via a refresh grant. */
export function providerSupportsRefresh(provider: OAuthProvider): boolean {
  return REFRESH_PROVIDERS.has(provider);
}

/**
 * Whether a platform's tokens auto-renew (X/TikTok/YouTube) rather than expiring
 * and needing reconnect (LinkedIn/Facebook/Instagram). Drives the connections UI.
 */
export function platformAutoRenews(platform: Platform): boolean {
  return providerSupportsRefresh(PLATFORM_PROVIDER[platform]);
}

export const OAUTH_CONFIGS: Record<OAuthProvider, OAuthConfig> = {
  // LinkedIn — confidential client (client_secret), no PKCE required.
  // openid+profile resolve the member URN (author) via /userinfo; w_member_social posts.
  LINKEDIN: {
    provider: "LINKEDIN",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "w_member_social"],
    usesPkce: false,
  },

  // Meta (Facebook Pages + Instagram) — v25.0 dialog + Graph token exchange.
  META: {
    provider: "META",
    authUrl: "https://www.facebook.com/v25.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v25.0/oauth/access_token",
    scopes: [
      "pages_show_list",
      "pages_manage_posts",
      "pages_read_engagement",
      "business_management",
      "instagram_basic",
      "instagram_content_publish",
    ],
    usesPkce: false,
  },

  // X (Twitter) — OAuth 2.0 authorization code with PKCE; offline.access for refresh.
  X: {
    provider: "X",
    authUrl: "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    usesPkce: true,
  },

  // TikTok — Login Kit v2; PKCE required for web. The publisher uses the
  // Content Posting API in MEDIA_UPLOAD (inbox draft) mode, so it needs
  // video.upload only — not video.publish (direct post), which the app never
  // does. Requesting an unregistered/unused scope breaks the authorize step
  // and is flagged in TikTok app review.
  TIKTOK: {
    provider: "TIKTOK",
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic", "video.upload"],
    usesPkce: true,
  },

  // Google / YouTube — connect-only (no publish API); read scope + offline refresh.
  GOOGLE: {
    provider: "GOOGLE",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
    usesPkce: false,
  },
};

/** Resolve the OAuth config for a platform (Meta/Google are shared across platforms). */
export function getOAuthConfig(platform: Platform): OAuthConfig {
  return OAUTH_CONFIGS[PLATFORM_PROVIDER[platform]];
}
