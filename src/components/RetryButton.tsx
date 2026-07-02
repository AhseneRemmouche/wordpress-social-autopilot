"use client";

import type { ContentStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";

/**
 * Manual retry control for a FAILED item (FR-026). Renders nothing unless the
 * status is FAILED; on click it POSTs to the retry route, toasts the outcome, and
 * optimistically hides (the item is re-queued as APPROVED) while the view refreshes.
 */
export function RetryButton({
  contentId,
  status,
}: {
  contentId: string;
  status: ContentStatus;
}): ReactElement | null {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [requeued, setRequeued] = useState(false);

  if (status !== "FAILED" || requeued) return null;

  async function retry(): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch(`/api/content/${contentId}/retry`, { method: "POST" });
      if (!res.ok) throw new Error(`Retry failed (${res.status})`);
      setRequeued(true); // optimistic: FAILED → APPROVED (re-queued)
      toast.success("Retry queued — it will publish again shortly.");
      router.refresh();
    } catch {
      toast.error("Couldn't queue a retry. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <Button size="sm" variant="danger" onClick={() => void retry()} loading={busy}>
        Retry
      </Button>
    </div>
  );
}
