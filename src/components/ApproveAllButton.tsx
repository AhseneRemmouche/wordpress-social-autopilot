"use client";

import type { Platform } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";

export interface PendingItem {
  contentId: string;
  platform: Platform;
}

const PLATFORM_LABEL: Record<Platform, string> = {
  LINKEDIN: "LinkedIn",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  YOUTUBE: "YouTube",
  X: "X",
  TIKTOK: "TikTok",
};

/**
 * Bulk-approve every PENDING item on a post (UI-24). Confirms, then approves each
 * sequentially with a progress count. Failures are isolated (a failed platform
 * doesn't stop the rest) and named individually; a summary toast reports totals.
 * Renders nothing when there is nothing pending.
 */
export function ApproveAllButton({ pending }: { pending: PendingItem[] }): ReactElement | null {
  const router = useRouter();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  if (pending.length === 0) return null;

  async function approveAll(): Promise<void> {
    const total = pending.length;
    setProgress({ done: 0, total });
    let done = 0;
    let ok = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        const res = await fetch(`/api/content/${item.contentId}/approve`, { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        ok += 1;
      } catch {
        failed += 1;
        toast.error(`Couldn't approve ${PLATFORM_LABEL[item.platform]}.`);
      } finally {
        done += 1;
        setProgress({ done, total });
      }
    }

    setProgress(null);
    if (failed === 0) {
      toast.success(`Approved all ${ok} pending.`);
    } else {
      toast.info(`Approved ${ok} of ${total}; ${failed} failed.`);
    }
    router.refresh();
  }

  const busy = progress !== null;
  const label = progress
    ? `Approving ${progress.done}/${progress.total}…`
    : `Approve all pending (${pending.length})`;

  return (
    <>
      <Button size="sm" onClick={() => setConfirmOpen(true)} loading={busy}>
        {label}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Approve ${pending.length} pending ${pending.length === 1 ? "item" : "items"}?`}
        description="Each will be approved and queued to publish on its connected platform."
        confirmLabel="Approve all"
        onConfirm={() => {
          setConfirmOpen(false);
          void approveAll();
        }}
      />
    </>
  );
}
