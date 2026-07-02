import type { HTMLAttributes, ReactElement } from "react";

import { cx } from "@/components/ui/cx";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";
export type BadgeSize = "sm" | "md";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-muted ring-border",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-warning ring-warning/20",
  danger: "bg-danger/10 text-danger ring-danger/20",
  info: "bg-info/10 text-info ring-info/20",
};

const SIZES: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2 py-0.5 text-xs",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
}

/**
 * Base pill badge (UI-07): tinted tone + inset ring, token-driven so tints and
 * text flip correctly in dark mode (via the /opacity modifier on the tokens).
 */
export function Badge({
  tone = "neutral",
  size = "md",
  className,
  children,
  ...rest
}: BadgeProps): ReactElement {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset",
        TONES[tone],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
