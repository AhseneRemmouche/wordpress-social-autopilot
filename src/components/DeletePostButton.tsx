"use client";

import { useState, type ReactElement } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/ToastProvider";

/** Lucide-style trash icon, matching the app's hand-inlined stroke SVGs. */
function TrashIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/**
 * Per-row delete control for a post. Opens a destructive confirm dialog, then
 * DELETEs the post (and — via DB cascade — its generated content, publish jobs,
 * and audit logs). Removes the row from the live feed only AFTER the server
 * confirms the delete (via `onDeleted`), so the 5s poll can't resurrect it.
 */
export function DeletePostButton({
  postId,
  title,
  onDeleted,
}: {
  postId: string;
  title: string;
  onDeleted: (id: string) => void;
}): ReactElement {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function remove(): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Post deleted.");
      setConfirmOpen(false);
      onDeleted(postId);
    } catch {
      toast.error("Couldn't delete the post. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <IconButton
        label="Delete post"
        variant="ghost"
        size="sm"
        loading={busy}
        onClick={() => setConfirmOpen(true)}
      >
        <TrashIcon />
      </IconButton>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this post?"
        description={
          <>
            This removes “{title}” and all its generated platform content from the
            dashboard. This can’t be undone.
          </>
        }
        confirmLabel="Delete"
        variant="danger"
        loading={busy}
        onConfirm={() => void remove()}
      />
    </>
  );
}
