import type { ButtonHTMLAttributes, ReactElement } from "react";

import {
  BUTTON_BASE,
  BUTTON_VARIANTS,
  ButtonSpinner,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 w-8 rounded-md",
  md: "h-9 w-9 rounded-lg",
};

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Required accessible name (→ aria-label + title) since there is no text. */
  label: string;
}

/**
 * A square, icon-only button (UI-05). Requires a `label` for accessibility.
 * Shares the Button base/variant styles.
 */
export function IconButton({
  variant = "secondary",
  size = "md",
  loading = false,
  label,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: IconButtonProps): ReactElement {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || loading || undefined}
      aria-busy={loading || undefined}
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], ICON_SIZES[size], className)}
      {...rest}
    >
      {loading ? <ButtonSpinner className="h-4 w-4" /> : children}
    </button>
  );
}
