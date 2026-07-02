"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactElement } from "react";

import { PostList } from "@/components/PostList";
import type { PostSummary } from "@/components/PostRow";
import { SummaryStrip, type SummaryCounts } from "@/components/SummaryStrip";
import { Skeleton } from "@/components/ui/Skeleton";

const POLL_MS = 5000;

/** Aggregate per-platform statuses needing attention across all posts. */
function computeCounts(posts: PostSummary[]): SummaryCounts {
  const counts: SummaryCounts = { pending: 0, failed: 0, manual: 0 };
  for (const post of posts) {
    for (const p of post.platforms) {
      if (p.status === "PENDING") counts.pending += 1;
      else if (p.status === "FAILED") counts.failed += 1;
      else if (p.status === "MANUAL_REQUIRED") counts.manual += 1;
    }
  }
  return counts;
}

/** Apply the URL filters (?status=&platform=&q=) to the polled posts. */
function filterPosts(
  posts: PostSummary[],
  status: string,
  platform: string,
  q: string,
): PostSummary[] {
  const needle = q.trim().toLowerCase();
  return posts.filter((post) => {
    if (needle && !post.title.toLowerCase().includes(needle)) return false;
    if (!status && !platform) return true;
    return post.platforms.some(
      (p) => (!status || p.status === status) && (!platform || p.platform === platform),
    );
  });
}

function updatedLabel(ts: number | null): string {
  if (ts === null) return "Live";
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return "Updated just now";
  if (s < 60) return `Updated ${s}s ago`;
  return `Updated ${Math.round(s / 60)}m ago`;
}

/** First-load skeleton for the feed (used as the dashboard Suspense fallback). */
export function PostsFeedSkeleton(): ReactElement {
  return (
    <div className="space-y-2">
      {["a", "b", "c", "d", "e"].map((k) => (
        <Skeleton key={k} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Live post feed (Principle VI / FR-024). Seeded with server-rendered posts, then
 * polls GET /api/posts every 5s so status transitions appear without a refresh.
 * The URL filters (UI-17) are applied client-side, and a subtle indicator shows
 * when the data was last refreshed.
 */
export function PostsFeed({ initialPosts }: { initialPosts: PostSummary[] }): ReactElement {
  const [posts, setPosts] = useState(initialPosts);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const params = useSearchParams();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function poll(): Promise<void> {
      try {
        const res = await fetch("/api/posts", { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as PostSummary[];
        if (active) {
          setPosts(data);
          setUpdatedAt(Date.now());
        }
      } catch {
        // Ignore transient/aborted polls; the next tick retries.
      }
    }

    const id = setInterval(() => void poll(), POLL_MS);
    return () => {
      active = false;
      controller.abort();
      clearInterval(id);
    };
  }, []);

  const filtered = filterPosts(
    posts,
    params.get("status") ?? "",
    params.get("platform") ?? "",
    params.get("q") ?? "",
  );

  return (
    <div>
      <div className="mb-4">
        <SummaryStrip counts={computeCounts(posts)} />
      </div>
      <div className="mb-2 flex items-center justify-end gap-1.5 text-xs text-muted">
        <span
          className="h-1.5 w-1.5 rounded-full bg-success motion-safe:animate-pulse"
          aria-hidden="true"
        />
        <span suppressHydrationWarning>{updatedLabel(updatedAt)}</span>
      </div>
      <PostList posts={filtered} />
    </div>
  );
}
