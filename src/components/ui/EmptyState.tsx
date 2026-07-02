import type { ReactElement, ReactNode } from "react";

import { cx } from "@/components/ui/cx";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Optional call-to-action (e.g. a Button). */
  action?: ReactNode;
  className?: string;
}

/**
 * Empty / zero-data placeholder (UI-10): centered icon + title + description with
 * an optional action, in a dashed token-driven surface.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): ReactElement {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-10 text-center",
        className,
      )}
    >
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <h3 className="text-sm font-medium text-text">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
