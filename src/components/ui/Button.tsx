import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react";

import { cx } from "@/components/ui/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

/** Shared base + variant styles (also used by IconButton). Token-driven, dark-aware. */
export const BUTTON_BASE =
  "inline-flex items-center justify-center font-medium transition " +
  "motion-safe:active:scale-[0.98] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90 focus-visible:ring-primary/40",
  secondary:
    "border border-border bg-surface text-text hover:bg-surface-muted focus-visible:ring-primary/40",
  ghost: "text-text hover:bg-surface-muted focus-visible:ring-primary/40",
  danger: "bg-danger text-white hover:opacity-90 focus-visible:ring-danger/40",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-md px-3 text-xs",
  md: "h-9 gap-2 rounded-lg px-4 text-sm",
};

/** Inline spinner (a dedicated Spinner primitive arrives in UI-10). */
export function ButtonSpinner({ className }: { className?: string }): ReactElement {
  return (
    <svg
      className={cx("animate-spin", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
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

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/**
 * The app's Button primitive (UI-05): variants, sizes, loading (spinner +
 * disabled), and optional left/right icons. Extends the native button props.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps): ReactElement {
  return (
    <button
      type={type}
      disabled={disabled || loading || undefined}
      aria-busy={loading || undefined}
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {loading ? <ButtonSpinner className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
