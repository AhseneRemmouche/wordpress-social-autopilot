import type { PlatformAccount } from "@prisma/client";

import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getPublisher } from "@/lib/publishers";
import { backoffMs } from "@/lib/queue/backoff";

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
export async function processJob(jobId: string): Promise<void> {
  const job = await prisma.publishJob.findUnique({
    where: { id: jobId },
    include: { content: true },
  });

  // Already claimed, deleted, or terminal — nothing to do.
  if (!job || job.status !== "QUEUED") return;

  const content = job.content;
  const platform = content.platform;
  const attempt = job.attempts + 1;

  await writeAudit({ contentId: content.id, platform, attempt, outcome: "ATTEMPT" });

  // --- Account-status guard (FR-020): no live connection → hold for manual. ---
  const account = await prisma.platformAccount.findUnique({ where: { platform } });
  if (!account || account.status !== "CONNECTED") {
    await failPermanently(
      job.id,
      content.id,
      platform,
      attempt,
      "MANUAL_REQUIRED",
      "Account not connected",
    );
    return;
  }

  // Claim the job for this run.
  await prisma.publishJob.update({
    where: { id: job.id },
    data: { status: "RUNNING", attempts: attempt },
  });

  const result = await runPublish(content, account, platform);

  // --- Success ---
  if (result.ok) {
    await prisma.$transaction([
      prisma.publishJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", lastError: null },
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
    return;
  }

  // --- Retryable failure with attempts remaining → re-queue with backoff ---
  if (result.retryable && attempt < job.maxAttempts) {
    const runAt = new Date(Date.now() + backoffMs(attempt));
    await prisma.publishJob.update({
      where: { id: job.id },
      data: { status: "QUEUED", nextRunAt: runAt, lastError: result.error },
    });
    await writeAudit({
      contentId: content.id,
      platform,
      attempt,
      outcome: "FAILURE",
      errorContext: { retryable: true, nextRunAt: runAt.toISOString(), error: result.error },
    });
    return;
  }

  // --- Permanent failure (non-retryable, or retries exhausted) ---
  await failPermanently(job.id, content.id, platform, attempt, "FAILED", result.error);
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

/** Terminal failure: mark the job FAILED and the content to the given status. */
async function failPermanently(
  jobId: string,
  contentId: string,
  platform: PlatformAccount["platform"],
  attempt: number,
  contentStatus: "FAILED" | "MANUAL_REQUIRED",
  error: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.publishJob.update({
      where: { id: jobId },
      data: { status: "FAILED", lastError: error },
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
}
