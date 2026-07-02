"use client";

import type { ReactElement } from "react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Dashboard segment error boundary (client). Shows a friendly, secret-free
 * message with a retry — never the raw error text.
 */
export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  return (
    <EmptyState
      title="Something went wrong"
      description="An unexpected error occurred while loading this page. You can try again."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
