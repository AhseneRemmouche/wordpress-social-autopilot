import type { HTMLAttributes, ReactElement } from "react";

import { cx } from "@/components/ui/cx";

/**
 * Loading placeholder (UI-10). Give it width/height via className (e.g. `h-4 w-32`).
 * The `.shimmer` sweep is gated behind `prefers-reduced-motion: no-preference`
 * (globals.css), so it is a static muted block under reduced motion. Token-driven.
 */
export function Skeleton({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>): ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cx("shimmer rounded-md bg-surface-muted", className)}
      {...rest}
    />
  );
}
