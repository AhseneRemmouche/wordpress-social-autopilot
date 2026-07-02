"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cx } from "@/components/ui/cx";

// Client-mount detection without an effect/setState (hydration-safe): the server
// snapshot is false, the client snapshot true — so the portal only renders after
// hydration, matching the server HTML on the first pass.
const emptySubscribe = (): (() => void) => () => {};

export type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  variant: ToastVariant;
  title?: string;
  message: string;
}

export interface ToastOptions {
  variant?: ToastVariant;
  title?: string;
  message: string;
  /** Auto-dismiss delay in ms (default 5000). */
  duration?: number;
}

export interface ToastApi {
  toast: (opts: ToastOptions) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const DEFAULT_DURATION = 5000;

/**
 * Hand-rolled toast system (UI-11): context + portal + auto-dismiss + variants,
 * stacked bottom-right, dismissible, announced via an `aria-live` region.
 */
export function ToastProvider({ children }: { children: ReactNode }): ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const active = timers.current;
    return () => {
      active.forEach((t) => clearTimeout(t));
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const api = useMemo<ToastApi>(() => {
    const toast = (opts: ToastOptions): void => {
      const id = (idRef.current += 1);
      setToasts((prev) => [
        ...prev,
        { id, variant: opts.variant ?? "info", title: opts.title, message: opts.message },
      ]);
      const timer = setTimeout(() => dismiss(id), opts.duration ?? DEFAULT_DURATION);
      timers.current.set(id, timer);
    };
    return {
      toast,
      success: (message, title) => toast({ variant: "success", message, title }),
      error: (message, title) => toast({ variant: "error", message, title }),
      info: (message, title) => toast({ variant: "info", message, title }),
    };
  }, [dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-0 z-50 flex flex-col items-end justify-end gap-2 p-4"
            aria-live="polite"
            aria-atomic="false"
          >
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

const DOT: Record<ToastVariant, string> = {
  success: "bg-success",
  error: "bg-danger",
  info: "bg-info",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}): ReactElement {
  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-surface p-3 shadow-lg motion-safe:animate-toast-in"
    >
      <span className={cx("mt-1 h-2 w-2 shrink-0 rounded-full", DOT[toast.variant])} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text">{toast.title ?? toast.message}</p>
        {toast.title && <p className="mt-0.5 text-sm text-muted">{toast.message}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-0.5 text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/** Access the toast API. Must be used within <ToastProvider>. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return ctx;
}
