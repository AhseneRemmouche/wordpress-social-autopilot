import type { LabelHTMLAttributes, ReactElement } from "react";

import { cx } from "@/components/ui/cx";

/** Form label (UI-08). Associate with a control via `htmlFor`/`id`. */
export function Label({
  className,
  children,
  ...rest
}: LabelHTMLAttributes<HTMLLabelElement>): ReactElement {
  return (
    <label className={cx("block text-sm font-medium text-text", className)} {...rest}>
      {children}
    </label>
  );
}
