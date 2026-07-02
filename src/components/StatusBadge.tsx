import type { ContentStatus } from "@prisma/client";
import type { ReactElement } from "react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";

/**
 * Per-platform content-status pill (FR-024), rendered via the base Badge. The
 * `Record<ContentStatus, …>` keeps TypeScript enforcing that every status is
 * mapped. PENDING and MANUAL_REQUIRED both read as "needs attention" (warning),
 * disambiguated by label.
 */
const STATUS: Record<ContentStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "info" },
  PUBLISHED: { label: "Published", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "neutral" },
  MANUAL_REQUIRED: { label: "Manual", tone: "warning" },
};

export function StatusBadge({ status }: { status: ContentStatus }): ReactElement {
  const { label, tone } = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
