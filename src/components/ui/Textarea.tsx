import type { ReactElement, TextareaHTMLAttributes } from "react";

import { cx } from "@/components/ui/cx";
import { fieldClasses } from "@/components/ui/field";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

/** Multiline text input primitive (UI-08). */
export function Textarea({ error, className, ...rest }: TextareaProps): ReactElement {
  return (
    <textarea
      aria-invalid={error || undefined}
      className={cx(fieldClasses(error), "min-h-20 px-3 py-2 text-sm", className)}
      {...rest}
    />
  );
}
