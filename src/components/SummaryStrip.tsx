import Link from "next/link";
import type { ReactElement } from "react";

import { cx } from "@/components/ui/cx";

export interface SummaryCounts {
  pending: number;
  failed: number;
  manual: number;
}

interface Item {
  key: keyof SummaryCounts;
  label: string;
  href: string;
  tone: string;
}

const ITEMS: Item[] = [
  { key: "pending", label: "Pending review", href: "/dashboard?status=PENDING", tone: "text-warning" },
  { key: "failed", label: "Failed", href: "/dashboard?status=FAILED", tone: "text-danger" },
  { key: "manual", label: "Manual required", href: "/dashboard?status=MANUAL_REQUIRED", tone: "text-info" },
];

/**
 * Attention summary (UI-20): counts of content items needing action, each card
 * deep-linking to its filtered dashboard view. Counts are supplied by the live
 * feed (server-seeded, poll-refreshed).
 */
export function SummaryStrip({ counts }: { counts: SummaryCounts }): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className="rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="text-sm text-muted">{item.label}</span>
          <div className={cx("mt-1 text-2xl font-semibold tabular-nums", item.tone)}>
            {counts[item.key]}
          </div>
        </Link>
      ))}
    </div>
  );
}
