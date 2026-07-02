import type { AuditLog, AuditOutcome, Platform, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Audit logging (Constitution Principle V — one row per publish attempt/
 * success/failure; Principle II — no secrets persisted). FR-027 / FR-029.
 */

export interface WriteAuditInput {
  contentId: string;
  platform: Platform;
  attempt: number;
  outcome: AuditOutcome;
  externalId?: string;
  /** Arbitrary diagnostic context; secret-looking keys are redacted before storage. */
  errorContext?: unknown;
}

const REDACTED = "[REDACTED]";

// Keys whose values are redacted (case-insensitive substring match).
const SENSITIVE_KEY =
  /(token|secret|password|passwd|authorization|signature|api[_-]?key|apikey|bearer|cookie|credential)/i;

/**
 * Recursively produce a JSON-safe copy of `value` with the values of any
 * secret-looking keys replaced by `[REDACTED]`. Errors/Dates are normalized;
 * functions/symbols/bigints become null; cycles become `[CIRCULAR]`.
 */
export function redactSecrets(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) return null;

  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return value;
  }
  if (type !== "object") return null; // function / symbol / bigint

  const obj = value as object;
  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof Error) return { name: obj.name, message: obj.message };
  if (seen.has(obj)) return "[CIRCULAR]";
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSecrets(item, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactSecrets(val, seen);
  }
  return out;
}

/**
 * Persist one audit row. Best-effort: a logging failure must never break the
 * publish flow, so DB errors are caught and `null` is returned (the failure is
 * noted without any secret material).
 */
export async function writeAudit(
  input: WriteAuditInput,
): Promise<AuditLog | null> {
  const data: Prisma.AuditLogCreateInput = {
    content: { connect: { id: input.contentId } },
    platform: input.platform,
    attempt: input.attempt,
    outcome: input.outcome,
    externalId: input.externalId,
  };

  if (input.errorContext !== undefined) {
    data.errorContext = redactSecrets(input.errorContext) as Prisma.InputJsonValue;
  }

  try {
    return await prisma.auditLog.create({ data });
  } catch {
    // No secrets in this message — just identifiers for diagnosis.
    console.error(
      `[audit] failed to persist audit log (content=${input.contentId}, platform=${input.platform}, outcome=${input.outcome})`,
    );
    return null;
  }
}
