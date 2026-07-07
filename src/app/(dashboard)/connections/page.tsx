import type { Platform } from "@prisma/client";
import { Suspense, type ReactElement } from "react";

import { ConnectionCard, type ConnectionView } from "@/components/ConnectionCard";
import { OAuthReturnToast } from "@/components/OAuthReturnToast";
import { accountAutoRenews } from "@/lib/oauth/config";
import { prisma } from "@/lib/prisma";

// Always render fresh (owner-gated by the (dashboard) layout).
export const dynamic = "force-dynamic";

const ALL_PLATFORMS: Platform[] = [
  "LINKEDIN",
  "FACEBOOK",
  "INSTAGRAM",
  "X",
  "TIKTOK",
  "YOUTUBE",
];

const PLATFORM_LABEL: Record<Platform, string> = {
  LINKEDIN: "LinkedIn",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  YOUTUBE: "YouTube",
  X: "X",
  TIKTOK: "TikTok",
};

/** Per-platform connection view for all six platforms (missing rows → DISCONNECTED). */
async function loadConnections(): Promise<ConnectionView[]> {
  const accounts = await prisma.platformAccount.findMany({
    // `refreshToken` is read only to derive the boolean `autoRenews`; the token
    // ciphertext itself is never rendered into the page.
    select: {
      platform: true,
      status: true,
      expiresAt: true,
      autoPublish: true,
      refreshToken: true,
    },
  });
  const byPlatform = new Map(accounts.map((a) => [a.platform, a]));

  return ALL_PLATFORMS.map((platform) => {
    const account = byPlatform.get(platform);
    return {
      platform,
      status: account?.status ?? "DISCONNECTED",
      expiresAt: account?.expiresAt?.toISOString() ?? null,
      autoPublish: account?.autoPublish ?? false,
      autoRenews: accountAutoRenews(platform, Boolean(account?.refreshToken)),
    };
  });
}

/**
 * Connections page (FR-020/FR-021/FR-025): one ConnectionCard per platform with
 * status, Connect/Reconnect (OAuth start) / Disconnect actions, and the
 * per-platform auto-publish toggle.
 */
export default async function ConnectionsPage(): Promise<ReactElement> {
  const connections = await loadConnections();
  const expired = connections.filter((c) => c.status === "TOKEN_EXPIRED");

  return (
    <div>
      <Suspense fallback={null}>
        <OAuthReturnToast />
      </Suspense>

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text">Connections</h1>
        <p className="mt-1 text-sm text-muted">
          Connect each platform and control auto-publish. Expired tokens must be reconnected before
          publishing resumes.
        </p>
      </div>

      {expired.length > 0 && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 h-5 w-5 shrink-0 text-warning"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
          <div>
            <p className="text-sm font-medium text-text">
              {expired.length === 1
                ? "1 platform needs reconnecting"
                : `${expired.length} platforms need reconnecting`}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {expired.map((c) => PLATFORM_LABEL[c.platform]).join(", ")} — the access token expired.
              Reconnect to keep publishing (posts are held, never silently dropped).
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {connections.map((connection) => (
          <ConnectionCard key={connection.platform} connection={connection} />
        ))}
      </div>
    </div>
  );
}
