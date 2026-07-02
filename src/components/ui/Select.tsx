import type { ReactElement, SelectHTMLAttributes } from "react";

import { cx } from "@/components/ui/cx";
import { fieldClasses } from "@/components/ui/field";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

/** Native select primitive (UI-08) — keeps the accessible native control. */
export function Select({ error, className, children, ...rest }: SelectProps): ReactElement {
  return (
    <select
      aria-invalid={error || undefined}
      className={cx(fieldClasses(error), "h-9 px-3 pr-8 text-sm", className)}
      {...rest}
    >
      {children}
    </select>
  );
}
