import Link from "next/link";
import type { ReactElement } from "react";

import { EmptyState } from "@/components/ui/EmptyState";

/** Shown when a post id doesn't resolve (the detail page calls notFound()). */
export default function PostNotFound(): ReactElement {
  return (
    <EmptyState
      title="Post not found"
      description="This post no longer exists or was never received."
      action={
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Back to posts
        </Link>
      }
    />
  );
}
