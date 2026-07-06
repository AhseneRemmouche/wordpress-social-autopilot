import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { ApproveAllButton, type PendingItem } from "@/components/ApproveAllButton";
import { PlatformPreviewCard, type ContentPreview } from "@/components/PlatformPreviewCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/prisma";
import { composePostText } from "@/lib/publishers/compose";

// Always render fresh (owner-gated by the (dashboard) layout).
export const dynamic = "force-dynamic";

/**
 * Post review detail (FR-023): the triggering post plus its per-platform
 * GeneratedContent previews, each rendered as a PlatformPreviewCard with the
 * body/hashtags/link, status badge, and Approve/Reject (PENDING) or Retry (FAILED)
 * actions. Up to six cards (one per platform).
 */
export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<ReactElement> {
  const { postId } = await params;

  const post = await prisma.wordPressPost.findUnique({
    where: { id: postId },
    select: {
      id: true,
      title: true,
      url: true,
      featuredImageUrl: true,
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
    notFound();
  }

  const content: ContentPreview[] = post.generatedContent.map((c) => ({
    contentId: c.id,
    platform: c.platform,
    status: c.status,
    body: c.body,
    hashtags: c.hashtags,
    link: c.link,
    charCount: c.charCount,
    // The exact ready-to-paste caption (body + hashtags + backlink, within limit).
    copyText: composePostText(c),
    // Same featured image for every platform of the post (may be null).
    featuredImageUrl: post.featuredImageUrl,
  }));

  const pending: PendingItem[] = content
    .filter((c) => c.status === "PENDING")
    .map((c) => ({ contentId: c.contentId, platform: c.platform }));

  return (
    <div>
      <div className="sticky top-14 z-10 -mx-6 mb-6 border-b border-border bg-bg/80 px-6 py-3 backdrop-blur">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:underline"
        >
          <span aria-hidden="true">←</span> Back to posts
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="min-w-0 truncate text-lg font-semibold text-text">{post.title}</h1>
          <a
            href={post.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 rounded text-sm text-muted underline-offset-2 transition-colors hover:text-text hover:underline focus-visible:text-text focus-visible:underline focus-visible:outline-none"
          >
            View post
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
            </svg>
          </a>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="mb-4 flex justify-end">
          <ApproveAllButton pending={pending} />
        </div>
      )}

      {content.length === 0 ? (
        <EmptyState
          title="Generating content…"
          description="Platform content for this post is still being generated. This view updates when it's ready."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {content.map((c) => (
            <PlatformPreviewCard key={c.contentId} content={c} />
          ))}
        </div>
      )}
    </div>
  );
}
