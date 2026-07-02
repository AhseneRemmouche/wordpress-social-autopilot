import type { ReactElement } from "react";

import { PostRow, type PostSummary } from "@/components/PostRow";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * The dashboard post list (FR-024): a divided list of PostRow items, or an empty
 * state when nothing matches. Token-driven surface so it reads well in light/dark.
 */
export function PostList({ posts }: { posts: PostSummary[] }): ReactElement {
  if (posts.length === 0) {
    return (
      <EmptyState
        title="No posts to show"
        description="Publish a WordPress post — or adjust the filters above — to see generated content here."
      />
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {posts.map((post) => (
        <li key={post.id}>
          <PostRow post={post} />
        </li>
      ))}
    </ul>
  );
}
