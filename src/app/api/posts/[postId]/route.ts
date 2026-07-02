import type { ContentStatus, Platform } from "@prisma/client";

import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";

// Uses prisma (pg adapter) — Node runtime only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ContentPreview {
  contentId: string;
  platform: Platform;
  status: ContentStatus;
  body: string;
  hashtags: string[];
  link: string;
  charCount: number;
}

interface PostDetailView {
  id: string;
  title: string;
  url: string;
  content: ContentPreview[];
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * GET /api/posts/[postId] (contracts/dashboard-api.md, FR-023). Owner-only.
 * Returns one triggering post plus its per-platform GeneratedContent previews
 * (up to six) — the full body, hashtags, backlink, and character count that
 * drive the post-detail preview/approve view. 404 if the post does not exist.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ postId: string }> },
): Promise<Response> {
  if (!(await requireOwner(request))) {
    return json({ error: "unauthorized" }, 401);
  }

  const { postId } = await context.params;

  const post = await prisma.wordPressPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      url: true,
      generatedContent: {
        select: {
          id: true,
          platform: true,
          status: true,
          body: true,
          hashtags: true,
          link: true,
          charCount: true,
        },
        orderBy: { platform: "asc" },
      },
    },
  });

  if (!post) {
    return json({ error: "post not found" }, 404);
  }

  const view: PostDetailView = {
    id: post.id,
    title: post.title,
    url: post.url,
    content: post.generatedContent.map((content) => ({
      contentId: content.id,
      platform: content.platform,
      status: content.status,
      body: content.body,
      hashtags: content.hashtags,
      link: content.link,
      charCount: content.charCount,
    })),
  };

  return json(view, 200);
}
