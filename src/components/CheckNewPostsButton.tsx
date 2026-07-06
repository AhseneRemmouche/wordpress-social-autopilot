"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";

interface CheckNewResult {
  imported: number;
  generated: number;
  pending: number;
}

const plural = (n: number): string => (n === 1 ? "" : "s");

/**
 * Dashboard "Check for new posts" button (manual pull). POSTs to
 * /api/posts/check-new, which imports newly published WordPress posts and
 * generates their platform drafts within a time budget. On success it toasts the
 * outcome and refreshes so the new row(s) appear (PostsFeed also polls every ~5s).
 * If a backlog didn't finish in one shot (`pending > 0`), it says so — clicking
 * again resumes the rest.
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
      const { generated, pending } = (await res.json()) as CheckNewResult;

      if (pending > 0) {
        toast.success(
          `Generated ${generated} — ${pending} more to process. Click again to finish.`,
        );
        router.refresh();
      } else if (generated > 0) {
        toast.success(`Imported & generated ${generated} new post${plural(generated)}.`);
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
