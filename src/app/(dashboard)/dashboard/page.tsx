import { Suspense, type ReactElement } from "react";

import { CheckNewPostsButton } from "@/components/CheckNewPostsButton";
import { DashboardToolbar } from "@/components/DashboardToolbar";
import { PostsFeed, PostsFeedSkeleton } from "@/components/PostsFeed";
import type { PostSummary } from "@/components/PostRow";
import { prisma } from "@/lib/prisma";

// Always render fresh (owner-gated by the (dashboard) layout).
export const dynamic = "force-dynamic";

/** Load triggering posts with per-platform status (same shape as GET /api/posts). */
async function loadPosts(): Promise<PostSummary[]> {
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

  return posts.map((post) => ({
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
}

/**
 * Dashboard home (FR-024): server-renders the current post list, then hands off
 * to the polling PostsFeed so status changes appear live.
 */
export default async function DashboardPage(): Promise<ReactElement> {
  const initialPosts = await loadPosts();

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-text">Posts</h1>
          <p className="mt-1 text-sm text-muted">
            Generated content per WordPress publish. Status updates live.
          </p>
        </div>
        <CheckNewPostsButton />
      </div>

      {/* Toolbar + feed both read the URL query, so they sit in a Suspense boundary. */}
      <Suspense fallback={<PostsFeedSkeleton />}>
        <div className="mb-4">
          <DashboardToolbar />
        </div>
        <PostsFeed initialPosts={initialPosts} />
      </Suspense>
    </div>
  );
}
