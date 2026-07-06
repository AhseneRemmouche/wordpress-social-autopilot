"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactElement } from "react";

import { PostList } from "@/components/PostList";
import type { PostSummary } from "@/components/PostRow";
import { SummaryStrip, type SummaryCounts } from "@/components/SummaryStrip";
import { cx } from "@/components/ui/cx";
import { Skeleton } from "@/components/ui/Skeleton";

const POLL_MS = 5000;

const STATUS_KEYS: Partial<Record<string, keyof SummaryCounts>> = {
  PENDING: "pending",
  FAILED: "failed",
  MANUAL_REQUIRED: "manual",
};

/**
 * Aggregate attention counts across all posts. A post counts once per bucket it
 * has any item in (mirroring the card's `?status=` filtered list), while items
 * tally every platform entry.
 */
function computeCounts(posts: PostSummary[]): SummaryCounts {
  const counts: SummaryCounts = {
    pending: { posts: 0, items: 0 },
    failed: { posts: 0, items: 0 },
    manual: { posts: 0, items: 0 },
  };
  for (const post of posts) {
    const seen = new Set<keyof SummaryCounts>();
    for (const p of post.platforms) {
      const key = STATUS_KEYS[p.status];
      if (!key) continue;
      counts[key].items += 1;
      if (!seen.has(key)) {
        seen.add(key);
        counts[key].posts += 1;
      }
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
  const [stale, setStale] = useState(false);
  const params = useSearchParams();

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function poll(): Promise<void> {
      try {
        const res = await fetch("/api/posts", { signal: controller.signal });
        if (!res.ok) {
          // e.g. expired session (401) — flag it instead of freezing silently.
          if (active) setStale(true);
          return;
        }
        const data = (await res.json()) as PostSummary[];
        if (active) {
          setPosts(data);
          setUpdatedAt(Date.now());
          setStale(false);
        }
      } catch (error) {
        // Aborted polls (unmount) are expected; anything else marks the data stale.
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setStale(true);
        }
      }
    }

    const id = setInterval(() => void poll(), POLL_MS);
    return () => {
      active = false;
      controller.abort();
      clearInterval(id);
    };
  }, []);

  // Drop a row once the server confirms its delete; the next poll won't return it.
  const handleDeleted = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
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
          className={cx(
            "h-1.5 w-1.5 rounded-full",
            stale ? "bg-warning" : "bg-success motion-safe:animate-pulse",
          )}
          aria-hidden="true"
        />
        <span suppressHydrationWarning>
          {stale ? "Refresh paused — retrying" : updatedLabel(updatedAt)}
        </span>
      </div>
      <PostList posts={filtered} onDeleted={handleDeleted} />
    </div>
  );
}
