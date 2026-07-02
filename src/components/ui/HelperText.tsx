import type { HTMLAttributes, ReactElement } from "react";

import { cx } from "@/components/ui/cx";

export interface HelperTextProps extends HTMLAttributes<HTMLParagraphElement> {
  error?: boolean;
}

/**
 * Helper / error text beneath a field (UI-08). Give it an `id` and reference it
 * from the control's `aria-describedby` for accessible error messaging.
 */
export function HelperText({
  error,
  className,
  children,
  ...rest
}: HelperTextProps): ReactElement {
  return (
    <p className={cx("mt-1 text-xs", error ? "text-danger" : "text-muted", className)} {...rest}>
      {children}
    </p>
  );
}
