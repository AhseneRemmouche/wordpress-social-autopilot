import type { GeneratedContent, Platform, PlatformAccount, PublishJob } from "@prisma/client";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ publishMock: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    publishJob: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    platformAccount: { findUnique: vi.fn() },
    generatedContent: { update: vi.fn() },
    // $transaction just runs the array of (already-issued) promises.
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/alert", () => ({ sendAlert: vi.fn() }));
vi.mock("@/lib/publishers", () => ({
  getPublisher: () => ({
    platform: "LINKEDIN",
    capabilities: { autoPublish: true, requiresMedia: false },
    publish: h.publishMock,
  }),
}));

import { sendAlert } from "@/lib/alert";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { processJob } from "@/lib/queue/process-job";

const findJob = prisma.publishJob.findUnique as unknown as Mock;
const updateJob = prisma.publishJob.update as unknown as Mock;
const claimJob = prisma.publishJob.updateMany as unknown as Mock;
const alertMock = sendAlert as unknown as Mock;
const findAccount = prisma.platformAccount.findUnique as unknown as Mock;
const updateContent = prisma.generatedContent.update as unknown as Mock;
const writeAuditMock = writeAudit as unknown as Mock;

function jobRow(over: Partial<PublishJob> = {}): PublishJob & { content: GeneratedContent } {
  return {
    id: "job-1",
    contentId: "gc-1",
    status: "QUEUED",
    attempts: 0,
    maxAttempts: 3,
    nextRunAt: new Date(0),
    lastError: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    content: {
      id: "gc-1",
      postId: "wp-1",
      platform: "LINKEDIN" as Platform,
      body: "Body https://blog.example.com/x",
      hashtags: ["#a"],
      link: "https://blog.example.com/x",
      charCount: 30,
      status: "APPROVED",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as GeneratedContent,
    ...over,
  } as PublishJob & { content: GeneratedContent };
}

const CONNECTED = { platform: "LINKEDIN", status: "CONNECTED" } as PlatformAccount;

/** Return the data payload of the publishJob.update call that set a given status. */
function jobUpdateFor(status: string): Record<string, unknown> | undefined {
  const call = updateJob.mock.calls.find((c) => c[0]?.data?.status === status);
  return call?.[0]?.data as Record<string, unknown> | undefined;
}
function contentUpdateStatus(): unknown {
  return updateContent.mock.calls.at(-1)?.[0]?.data?.status;
}

beforeEach(() => {
  findJob.mockReset().mockResolvedValue(jobRow());
  updateJob.mockReset().mockResolvedValue({});
  claimJob.mockReset().mockResolvedValue({ count: 1 }); // claim wins by default
  findAccount.mockReset().mockResolvedValue(CONNECTED);
  updateContent.mockReset().mockResolvedValue({});
  writeAuditMock.mockReset();
  alertMock.mockReset();
  h.publishMock.mockReset();
});

describe("processJob (plan §8 / FR-016/027/030)", () => {
  it("success → content PUBLISHED, job SUCCEEDED, SUCCESS audit with externalId", async () => {
    h.publishMock.mockResolvedValue({ ok: true, externalId: "urn:li:123" });

    await processJob("job-1");

    expect(jobUpdateFor("SUCCEEDED")).toBeDefined();
    expect(contentUpdateStatus()).toBe("PUBLISHED");
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "SUCCESS", externalId: "urn:li:123" }),
    );
  });

  it("retryable failure with attempts remaining → re-QUEUED with future nextRunAt", async () => {
    h.publishMock.mockResolvedValue({ ok: false, retryable: true, error: "HTTP 429" });

    await processJob("job-1");

    const requeue = jobUpdateFor("QUEUED");
    expect(requeue).toBeDefined();
    expect((requeue?.nextRunAt as Date).getTime()).toBeGreaterThanOrEqual(Date.now() - 5);
    expect(requeue?.lastError).toBe("HTTP 429");
    // Content is NOT marked failed — it will be retried.
    expect(updateContent).not.toHaveBeenCalled();
  });

  it("retryable failure on the last attempt → permanent FAILED", async () => {
    findJob.mockResolvedValue(jobRow({ attempts: 2, maxAttempts: 3 })); // this run = attempt 3
    h.publishMock.mockResolvedValue({ ok: false, retryable: true, error: "HTTP 500" });

    await processJob("job-1");

    expect(jobUpdateFor("FAILED")).toBeDefined();
    expect(contentUpdateStatus()).toBe("FAILED");
    // No re-queue after exhaustion.
    expect(jobUpdateFor("QUEUED")).toBeUndefined();
  });

  it("non-retryable failure → immediate FAILED (no re-queue)", async () => {
    h.publishMock.mockResolvedValue({ ok: false, retryable: false, error: "bad request" });

    await processJob("job-1");

    expect(jobUpdateFor("FAILED")).toBeDefined();
    expect(contentUpdateStatus()).toBe("FAILED");
    expect(jobUpdateFor("QUEUED")).toBeUndefined();
  });

  it("account not connected → content MANUAL_REQUIRED, job FAILED, publisher never called", async () => {
    findAccount.mockResolvedValue({ platform: "LINKEDIN", status: "TOKEN_EXPIRED" } as PlatformAccount);

    await processJob("job-1");

    expect(h.publishMock).not.toHaveBeenCalled();
    expect(jobUpdateFor("FAILED")).toBeDefined();
    expect(contentUpdateStatus()).toBe("MANUAL_REQUIRED");
  });

  it("missing account → content MANUAL_REQUIRED", async () => {
    findAccount.mockResolvedValue(null);
    await processJob("job-1");
    expect(contentUpdateStatus()).toBe("MANUAL_REQUIRED");
    expect(h.publishMock).not.toHaveBeenCalled();
  });

  it("a thrown publisher error is treated as retryable", async () => {
    h.publishMock.mockRejectedValue(new Error("socket hang up"));
    await processJob("job-1");
    const requeue = jobUpdateFor("QUEUED");
    expect(requeue).toBeDefined();
    expect(requeue?.lastError).toContain("socket hang up");
  });

  it("loses the atomic claim (count 0) → no publish, no writes (double-claim guard)", async () => {
    claimJob.mockResolvedValue({ count: 0 }); // another runner claimed it, or it's gone/terminal
    await processJob("job-1");
    expect(h.publishMock).not.toHaveBeenCalled();
    expect(updateJob).not.toHaveBeenCalled();
    expect(findJob).not.toHaveBeenCalled(); // returns before loading the job
    expect(writeAuditMock).not.toHaveBeenCalled();
  });

  it("claims atomically via updateMany(where status=QUEUED → RUNNING)", async () => {
    h.publishMock.mockResolvedValue({ ok: true, externalId: "urn:li:1" });
    await processJob("job-1");
    const claim = claimJob.mock.calls[0]?.[0];
    expect(claim.where).toEqual({ id: "job-1", status: "QUEUED" });
    expect(claim.data).toEqual({ status: "RUNNING" });
  });

  it("content already PUBLISHED → settles job SUCCEEDED without re-posting (idempotency)", async () => {
    findJob.mockResolvedValue({
      ...jobRow(),
      content: { ...jobRow().content, status: "PUBLISHED" },
    });
    await processJob("job-1");
    expect(h.publishMock).not.toHaveBeenCalled();
    expect(jobUpdateFor("SUCCEEDED")).toBeDefined();
    expect(updateContent).not.toHaveBeenCalled(); // no re-publish of the content
  });

  it("skips a missing job after a claim race", async () => {
    findJob.mockResolvedValue(null);
    await processJob("gone");
    expect(writeAuditMock).not.toHaveBeenCalled();
    expect(h.publishMock).not.toHaveBeenCalled();
  });

  it("success → returns 'published' and does not alert", async () => {
    h.publishMock.mockResolvedValue({ ok: true, externalId: "urn:li:1" });
    const outcome = await processJob("job-1");
    expect(outcome).toBe("published");
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("permanent publish failure → returns 'failed' and alerts (secret-free)", async () => {
    h.publishMock.mockResolvedValue({ ok: false, retryable: false, error: "HTTP 400" });
    const outcome = await processJob("job-1");
    expect(outcome).toBe("failed");
    expect(alertMock).toHaveBeenCalledTimes(1);
    const msg = alertMock.mock.calls[0]?.[0] as string;
    expect(msg).toContain("LINKEDIN");
    expect(msg).toContain("HTTP 400");
    expect(msg).not.toContain("token-123"); // no secrets leak into alerts
  });

  it("MANUAL_REQUIRED hold (not connected) → returns 'manual' and does NOT alert", async () => {
    findAccount.mockResolvedValue({ platform: "LINKEDIN", status: "TOKEN_EXPIRED" } as PlatformAccount);
    const outcome = await processJob("job-1");
    expect(outcome).toBe("manual");
    expect(alertMock).not.toHaveBeenCalled(); // expected hold, not an incident
  });
});
