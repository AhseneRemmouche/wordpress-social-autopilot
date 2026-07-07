import type { PlatformAccount } from "@prisma/client";

import { sendAlert } from "@/lib/alert";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getPublisher } from "@/lib/publishers";
import { backoffMs } from "@/lib/queue/backoff";

/** The disposition of one job run, for the tick's counts + alerting. */
export type ProcessOutcome = "published" | "requeued" | "failed" | "manual" | "skipped";

/**
 * Process a single publish job (plan §8, FR-016/FR-027/FR-030).
 *
 * Flow for one job:
 *  1. Load the job + its GeneratedContent. Skip if gone or not QUEUED.
 *  2. Account-status guard: if the platform account is not CONNECTED, the item
 *     cannot be published automatically → content MANUAL_REQUIRED, job FAILED.
 *  3. Otherwise attempt the publish via the platform's isolated Publisher.
 *      - success        → content PUBLISHED, job SUCCEEDED (audit SUCCESS)
 *      - retryable fail  → job re-QUEUED with a jittered backoff nextRunAt,
 *                          unless attempts are exhausted (→ permanent FAILED)
 *      - permanent fail  → content FAILED, job FAILED (audit FAILURE)
 *
 * One job's outcome never affects another platform's (per-platform isolation).
 * All audit context is secret-free (the audit writer also redacts).
 */
export async function processJob(jobId: string): Promise<ProcessOutcome> {
  // --- Atomic claim: exactly one runner can flip QUEUED → RUNNING. ---
  // Two overlapping ticks would otherwise both read a QUEUED job and double-post
  // (a real incident on this project). updateMany is a single conditional write;
  // count === 0 means another runner won the claim, or the job is gone/terminal.
  const claim = await prisma.publishJob.updateMany({
    where: { id: jobId, status: "QUEUED" },
    data: { status: "RUNNING" },
  });
  if (claim.count === 0) return "skipped";

  const job = await prisma.publishJob.findUnique({
    where: { id: jobId },
    include: { content: true },
  });
  if (!job) return "skipped"; // deleted between claim and read (shouldn't happen)

  const content = job.content;
  const platform = content.platform;
  const attempt = job.attempts + 1;

  // --- Idempotency guard: the content is already published (a duplicate job, or
  // a retry of a publish whose success response was lost) → settle the job and do
  // NOT hit the platform API again. ---
  if (content.status === "PUBLISHED") {
    await prisma.publishJob.update({
      where: { id: job.id },
      data: { status: "SUCCEEDED", attempts: attempt, lastError: null },
    });
    return "skipped";
  }

  await writeAudit({ contentId: content.id, platform, attempt, outcome: "ATTEMPT" });

  // --- Account-status guard (FR-020): no live connection → hold for manual. ---
  const account = await prisma.platformAccount.findUnique({ where: { platform } });
  if (!account || account.status !== "CONNECTED") {
    return failPermanently(
      job.id,
      content.id,
      platform,
      attempt,
      "MANUAL_REQUIRED",
      "Account not connected",
    );
  }

  const result = await runPublish(content, account, platform);

  // --- Success ---
  if (result.ok) {
    await prisma.$transaction([
      prisma.publishJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", attempts: attempt, lastError: null },
      }),
      prisma.generatedContent.update({
        where: { id: content.id },
        data: { status: "PUBLISHED" },
      }),
    ]);
    await writeAudit({
      contentId: content.id,
      platform,
      attempt,
      outcome: "SUCCESS",
      externalId: result.externalId,
    });
    return "published";
  }

  // --- Retryable failure with attempts remaining → re-queue with backoff ---
  if (result.retryable && attempt < job.maxAttempts) {
    const runAt = new Date(Date.now() + backoffMs(attempt));
    await prisma.publishJob.update({
      where: { id: job.id },
      data: { status: "QUEUED", attempts: attempt, nextRunAt: runAt, lastError: result.error },
    });
    await writeAudit({
      contentId: content.id,
      platform,
      attempt,
      outcome: "FAILURE",
      errorContext: { retryable: true, nextRunAt: runAt.toISOString(), error: result.error },
    });
    return "requeued";
  }

  // --- Permanent failure (non-retryable, or retries exhausted) ---
  return failPermanently(job.id, content.id, platform, attempt, "FAILED", result.error);
}

type RunResult =
  | { ok: true; externalId?: string }
  | { ok: false; retryable: boolean; error: string };

/** Invoke the platform publisher, converting a thrown error into a retryable failure. */
async function runPublish(
  content: Parameters<ReturnType<typeof getPublisher>["publish"]>[0],
  account: PlatformAccount,
  platform: PlatformAccount["platform"],
): Promise<RunResult> {
  try {
    return await getPublisher(platform).publish(content, account);
  } catch (error) {
    // An unexpected throw (network, bug) is treated as retryable — the message
    // is truncated and any secrets are stripped by the audit writer downstream.
    const message = error instanceof Error ? error.message : "Unknown publish error";
    return { ok: false, retryable: true, error: message.slice(0, 300) };
  }
}

/**
 * Terminal failure: mark the job FAILED and the content to the given status.
 * Returns "failed" for a real publish failure (which also fires an operator
 * alert) and "manual" for the expected no-connection / no-media hold (no alert).
 */
async function failPermanently(
  jobId: string,
  contentId: string,
  platform: PlatformAccount["platform"],
  attempt: number,
  contentStatus: "FAILED" | "MANUAL_REQUIRED",
  error: string,
): Promise<"failed" | "manual"> {
  await prisma.$transaction([
    prisma.publishJob.update({
      where: { id: jobId },
      data: { status: "FAILED", attempts: attempt, lastError: error },
    }),
    prisma.generatedContent.update({
      where: { id: contentId },
      data: { status: contentStatus },
    }),
  ]);
  await writeAudit({
    contentId,
    platform,
    attempt,
    outcome: "FAILURE",
    errorContext: { retryable: false, contentStatus, error },
  });

  // Alert only on a genuine publish failure — MANUAL_REQUIRED is an expected hold
  // (not connected / no media), not an incident. failPermanently is the single
  // FAILED transition, so this fires once per failure (no extra throttling).
  if (contentStatus === "FAILED") {
    await sendAlert(
      `⚠️ Publish failed (${platform}) after ${attempt} attempt(s): ${error} — content ${contentId}`,
    );
    return "failed";
  }
  return "manual";
}
