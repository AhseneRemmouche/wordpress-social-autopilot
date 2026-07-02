import type { ContentStatus, Platform } from "@prisma/client";
import Link from "next/link";
import type { ReactElement } from "react";

import { StatusBadge } from "@/components/StatusBadge";

/** One platform's generated-content status for a post (matches GET /api/posts). */
export interface PlatformStatus {
  platform: Platform;
  contentId: string;
  status: ContentStatus;
}

/** A triggering post summary as returned by GET /api/posts. */
export interface PostSummary {
  id: string;
  title: string;
  url: string;
  receivedAt: string;
  platforms: PlatformStatus[];
}

const PLATFORM_SHORT: Record<Platform, string> = {
  LINKEDIN: "LI",
  INSTAGRAM: "IG",
  FACEBOOK: "FB",
  YOUTUBE: "YT",
  X: "X",
  TIKTOK: "TT",
};

/** Compact host for display; falls back to the raw URL if unparseable. */
function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Coarse relative time ("just now", "5m ago", "2h ago", "3d ago", date). */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.round(diffMs / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return iso.slice(0, 10);
}

/**
 * A single row in the dashboard post list (FR-024): title, host, relative time,
 * and a per-platform status chip row. The whole row links to the review detail.
 * Responsive (stacks < sm), token-driven, with hover + focus-visible states.
 */
export function PostRow({ post }: { post: PostSummary }): ReactElement {
  return (
    <Link
      href={`/posts/${post.id}`}
      className="block px-4 py-3 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-text">{post.title}</h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <span className="truncate">{displayHost(post.url)}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.receivedAt} title={post.receivedAt} suppressHydrationWarning>
              {relativeTime(post.receivedAt)}
            </time>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
          {post.platforms.map((p) => (
            <span
              key={p.contentId}
              className="inline-flex items-center gap-1"
              title={p.platform}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {PLATFORM_SHORT[p.platform]}
              </span>
              <StatusBadge status={p.status} />
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
