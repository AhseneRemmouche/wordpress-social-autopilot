import type { ReactElement } from "react";

import { cx } from "@/components/ui/cx";

export type SwitchSize = "sm" | "md";

const TRACK: Record<SwitchSize, string> = {
  sm: "h-5 w-9",
  md: "h-6 w-11",
};
const THUMB: Record<SwitchSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
};
const THUMB_ON: Record<SwitchSize, string> = {
  sm: "translate-x-4",
  md: "translate-x-5",
};

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: SwitchSize;
  /** Accessible name (there is no visible text inside the control). */
  label: string;
  id?: string;
  className?: string;
}

/**
 * Reusable switch primitive (UI-09): `role="switch"` + `aria-checked`, keyboard
 * operable (native button → Space/Enter), disabled + focus ring, token-driven
 * (on = success, off = border) so it flips correctly in dark mode.
 */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  size = "sm",
  label,
  id,
  className,
}: SwitchProps): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cx(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:cursor-not-allowed disabled:opacity-50",
        TRACK[size],
        checked ? "bg-success" : "bg-border",
        className,
      )}
    >
      <span
        className={cx(
          "inline-block transform rounded-full bg-white shadow transition-transform",
          THUMB[size],
          checked ? THUMB_ON[size] : "translate-x-0.5",
        )}
      />
    </button>
  );
}
