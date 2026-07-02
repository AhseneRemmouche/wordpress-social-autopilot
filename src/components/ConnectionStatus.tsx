import type { AccountStatus } from "@prisma/client";
import type { ReactElement } from "react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";

/**
 * Connection-status indicator (FR-020), rendered via the base Badge with a
 * leading status dot. The `Record<AccountStatus, …>` keeps coverage exhaustive.
 */
const STATUS: Record<AccountStatus, { label: string; tone: BadgeTone }> = {
  CONNECTED: { label: "Connected", tone: "success" },
  TOKEN_EXPIRED: { label: "Token expired", tone: "warning" },
  DISCONNECTED: { label: "Not connected", tone: "neutral" },
};

export function ConnectionStatus({ status }: { status: AccountStatus }): ReactElement {
  const { label, tone } = STATUS[status];
  return (
    <Badge tone={tone}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </Badge>
  );
}
