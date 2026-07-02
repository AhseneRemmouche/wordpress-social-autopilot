"use client";

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
} from "react";

import { Button } from "@/components/ui/Button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** `danger` renders a destructive confirm button. */
  variant?: "default" | "danger";
  /** In-flight: disables cancel/backdrop/Escape and shows a spinner on confirm. */
  loading?: boolean;
}

/**
 * Accessible confirm modal (UI-12) built on the native <dialog> element:
 * showModal() traps focus + implies role="dialog"/aria-modal, Escape fires
 * `cancel`, and focus is restored to the invoker on close. Backdrop click and
 * Escape are blocked while `loading`. `danger` gives a destructive confirm.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "default",
  loading = false,
}: ConfirmDialogProps): ReactElement {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Escape (cancel) — block while loading, otherwise let the parent close it.
  function handleCancel(e: SyntheticEvent<HTMLDialogElement>): void {
    if (loading) {
      e.preventDefault();
      return;
    }
    onOpenChange(false);
  }

  // Backdrop click: the click targets the <dialog> element itself.
  function handleClick(e: MouseEvent<HTMLDialogElement>): void {
    if (!loading && e.target === ref.current) onOpenChange(false);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClose={() => onOpenChange(false)}
      onClick={handleClick}
      className="m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-xl border border-border bg-surface p-0 text-text shadow-lg backdrop:bg-black/40"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-base font-semibold text-text">
          {title}
        </h2>
        {description && <div className="mt-2 text-sm text-muted">{description}</div>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
