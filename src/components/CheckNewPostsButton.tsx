"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";

interface CheckNewResult {
  count: number;
}

/**
 * Dashboard "Check for new posts" button (manual pull). POSTs to
 * /api/posts/check-new, which imports any newly published WordPress posts and
 * generates their platform drafts. On success it toasts the outcome and
 * refreshes so the new row(s) appear (PostsFeed also polls every ~5s).
 */
export function CheckNewPostsButton(): ReactElement {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function check(): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch("/api/posts/check-new", { method: "POST" });
      if (!res.ok) throw new Error(`Check failed (${res.status})`);
      const { count } = (await res.json()) as CheckNewResult;
      if (count > 0) {
        toast.success(
          `Imported & generated ${count} new post${count > 1 ? "s" : ""}.`,
        );
        router.refresh();
      } else {
        toast.success("No new posts.");
      }
    } catch {
      toast.error("Couldn't check for new posts. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={() => void check()} loading={busy}>
      Check for new posts
    </Button>
  );
}
