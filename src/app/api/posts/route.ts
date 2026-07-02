import type { ContentStatus, Platform } from "@prisma/client";

import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";

// Uses prisma (pg adapter) — Node runtime only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PlatformStatusView {
  platform: Platform;
  contentId: string;
  status: ContentStatus;
}

interface PostView {
  id: string;
  title: string;
  url: string;
  receivedAt: string;
  platforms: PlatformStatusView[];
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * GET /api/posts (contracts/dashboard-api.md, FR-022/FR-024). Owner-only. Returns
 * every triggering WordPress post (most recent first) with its per-platform
 * generated-content status — `{ platform, contentId, status }` — for the
 * dashboard list view. No content bodies here (that's the detail endpoint).
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await requireOwner(request))) {
    return json({ error: "unauthorized" }, 401);
  }

  const posts = await prisma.wordPressPost.findMany({
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      title: true,
      url: true,
      receivedAt: true,
      generatedContent: {
        select: { id: true, platform: true, status: true },
        orderBy: { platform: "asc" },
      },
    },
  });

  const view: PostView[] = posts.map((post) => ({
    id: post.id,
    title: post.title,
    url: post.url,
    receivedAt: post.receivedAt.toISOString(),
    platforms: post.generatedContent.map((content) => ({
      platform: content.platform,
      contentId: content.id,
      status: content.status,
    })),
  }));

  return json(view, 200);
}
