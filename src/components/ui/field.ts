import { cx } from "@/components/ui/cx";

/**
 * Shared control styling for Input/Select/Textarea (UI-08). Token-driven and
 * dark-aware; the `error` state swaps the border + focus ring to danger.
 */
export function fieldClasses(error?: boolean): string {
  return cx(
    "w-full rounded-lg border bg-surface text-text transition-colors placeholder:text-muted",
    "focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
    error
      ? "border-danger focus-visible:ring-danger/40"
      : "border-border focus-visible:ring-primary/40",
  );
}
