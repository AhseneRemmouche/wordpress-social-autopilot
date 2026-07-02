import type { InputHTMLAttributes, ReactElement } from "react";

import { cx } from "@/components/ui/cx";
import { fieldClasses } from "@/components/ui/field";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

/** Text input primitive (UI-08). Sets `aria-invalid` in the error state. */
export function Input({ error, className, type = "text", ...rest }: InputProps): ReactElement {
  return (
    <input
      type={type}
      aria-invalid={error || undefined}
      className={cx(fieldClasses(error), "h-9 px-3 text-sm", className)}
      {...rest}
    />
  );
}
