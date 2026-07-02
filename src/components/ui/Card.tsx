import type { HTMLAttributes, ReactElement } from "react";

import { cx } from "@/components/ui/cx";

export type CardPadding = "none" | "sm" | "md" | "lg";

const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
}

/**
 * Surface container primitive (UI-06): token-driven surface + border + radius +
 * subtle elevation, with optional padding. Dark-aware via the semantic tokens.
 */
export function Card({ padding = "md", className, children, ...rest }: CardProps): ReactElement {
  return (
    <div
      className={cx(
        "rounded-xl border border-border bg-surface shadow-sm",
        PADDING[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
