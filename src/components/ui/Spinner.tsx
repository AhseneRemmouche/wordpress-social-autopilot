import type { ReactElement } from "react";

import { cx } from "@/components/ui/cx";

export type SpinnerSize = "sm" | "md" | "lg";

const SIZES: Record<SpinnerSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

/** Loading spinner (UI-10). `role="status"` + label for screen readers. */
export function Spinner({
  size = "md",
  className,
  label = "Loading",
}: {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}): ReactElement {
  return (
    <svg
      className={cx("animate-spin text-muted", SIZES[size], className)}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={label}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path
        d="M4 12a8 8 0 0 1 8-8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
