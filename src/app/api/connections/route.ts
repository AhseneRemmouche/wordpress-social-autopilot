import type { AccountStatus, Platform } from "@prisma/client";

import { platformAutoRenews } from "@/lib/oauth/config";
import { parsePlatformSlug } from "@/lib/oauth/platform";
import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";

// Uses prisma (pg adapter) — Node runtime only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALL_PLATFORMS: Platform[] = [
  "LINKEDIN",
  "FACEBOOK",
  "INSTAGRAM",
  "X",
  "TIKTOK",
  "YOUTUBE",
];

interface ConnectionView {
  platform: Platform;
  status: AccountStatus;
  expiresAt: string | null;
  autoPublish: boolean;
  autoRenews: boolean;
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function unauthorized(): Response {
  return json({ error: "unauthorized" }, 401);
}

/**
 * GET /api/connections (contracts/oauth.md, FR-020). Owner-only. Returns the
 * per-platform connection status for all six platforms — NEVER any token
 * material (FR-018). Platforms with no row default to DISCONNECTED.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await requireOwner(request))) return unauthorized();

  const accounts = await prisma.platformAccount.findMany({
    // Explicit select — token columns are never read into this response.
    select: { platform: true, status: true, expiresAt: true, autoPublish: true },
  });
  const byPlatform = new Map(accounts.map((a) => [a.platform, a]));

  const view: ConnectionView[] = ALL_PLATFORMS.map((platform) => {
    const account = byPlatform.get(platform);
    return {
      platform,
      status: account?.status ?? "DISCONNECTED",
      expiresAt: account?.expiresAt?.toISOString() ?? null,
      autoPublish: account?.autoPublish ?? false,
      autoRenews: platformAutoRenews(platform),
    };
  });

  return json(view, 200);
}

/**
 * DELETE /api/connections?platform=<P> (FR-021). Owner-only. Purges stored
 * (encrypted) tokens and sets the account DISCONNECTED. Idempotent.
 */
export async function DELETE(request: Request): Promise<Response> {
  if (!(await requireOwner(request))) return unauthorized();

  const slug = new URL(request.url).searchParams.get("platform");
  const platform = slug ? parsePlatformSlug(slug) : null;
  if (!platform) return json({ error: "unknown platform" }, 400);

  await prisma.platformAccount.updateMany({
    where: { platform },
    data: {
      status: "DISCONNECTED",
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      scope: null,
      externalAccountId: null,
      fbPageId: null,
      igUserId: null,
      connectedAt: null,
    },
  });

  return json({ ok: true, platform, status: "DISCONNECTED" }, 200);
}
