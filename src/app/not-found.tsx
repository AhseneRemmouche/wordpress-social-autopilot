import Link from "next/link";
import type { ReactElement } from "react";

import { EmptyState } from "@/components/ui/EmptyState";

/** Global 404 for unknown top-level routes (tokenized, outside the dashboard shell). */
export default function NotFound(): ReactElement {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg p-6 text-text">
      <EmptyState
        title="Page not found"
        description="The page you're looking for doesn't exist."
        action={
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-text transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Go to dashboard
          </Link>
        }
      />
    </main>
  );
}
