import type { ReactElement, ReactNode } from "react";

import { cx } from "@/components/ui/cx";

export interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned actions slot (buttons, toggles, …). */
  actions?: ReactNode;
  /** Heading level for the title (default h2). */
  as?: "h1" | "h2" | "h3";
  className?: string;
}

/**
 * Section title + optional description with a right-aligned actions slot (UI-06).
 * Token-driven; used above lists, cards, and page sections.
 */
export function SectionHeader({
  title,
  description,
  actions,
  as: Heading = "h2",
  className,
}: SectionHeaderProps): ReactElement {
  return (
    <div className={cx("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <Heading className="text-base font-semibold text-text">{title}</Heading>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
