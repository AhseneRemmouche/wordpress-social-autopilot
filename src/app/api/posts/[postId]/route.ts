import type { ContentStatus, Platform } from "@prisma/client";

import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";
import { buildPostUrl } from "@/lib/publishers/post-url";

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
  publishedUrl: string | null;
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
          auditLogs: {
            where: { outcome: "SUCCESS", externalId: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { externalId: true },
          },
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
      publishedUrl: buildPostUrl(content.platform, content.auditLogs?.[0]?.externalId ?? null),
    })),
  };

  return json(view, 200);
}

/**
 * DELETE /api/posts/[postId]. Owner-only. Removes the triggering post from the
 * app database. The FK `ON DELETE CASCADE` constraints remove its GeneratedContent
 * and, in turn, each content's PublishJob and AuditLog rows automatically — so a
 * single delete cleans up the whole tree. This does NOT delete the post on the
 * WordPress site. 404 if the post does not exist. Idempotent.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ postId: string }> },
): Promise<Response> {
  if (!(await requireOwner(request))) {
    return json({ error: "unauthorized" }, 401);
  }

  const { postId } = await context.params;

  // deleteMany (not delete) so a missing id returns count 0 instead of throwing.
  const { count } = await prisma.wordPressPost.deleteMany({ where: { id: postId } });
  if (count === 0) {
    return json({ error: "post not found" }, 404);
  }

  return json({ ok: true, id: postId }, 200);
}
