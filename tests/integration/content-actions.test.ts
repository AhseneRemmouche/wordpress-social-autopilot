import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB, the enqueue helper, and the owner guard (each has its own tests).
vi.mock("@/lib/prisma", () => {
  const generatedContent = { findUnique: vi.fn(), update: vi.fn() };
  const publishJob = { deleteMany: vi.fn(), updateMany: vi.fn(), create: vi.fn() };
  const $transaction = vi.fn();
  const prisma = { generatedContent, publishJob, $transaction };
  // Support BOTH transaction forms: array (reject) and interactive callback (retry).
  $transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function"
      ? (arg as (tx: typeof prisma) => unknown)(prisma)
      : Promise.all(arg as Array<Promise<unknown>>),
  );
  return { prisma };
});
vi.mock("@/lib/queue/enqueue", () => ({ enqueuePublish: vi.fn() }));
vi.mock("@/lib/oauth/session", () => ({ requireOwner: vi.fn() }));

import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";
import { enqueuePublish } from "@/lib/queue/enqueue";
import { POST as approve } from "@/app/api/content/[contentId]/approve/route";
import { POST as markPublished } from "@/app/api/content/[contentId]/mark-published/route";
import { POST as reject } from "@/app/api/content/[contentId]/reject/route";
import { POST as retry } from "@/app/api/content/[contentId]/retry/route";

const findUnique = prisma.generatedContent.findUnique as unknown as Mock;
const update = prisma.generatedContent.update as unknown as Mock;
const deleteMany = prisma.publishJob.deleteMany as unknown as Mock;
const updateMany = prisma.publishJob.updateMany as unknown as Mock;
const createJob = prisma.publishJob.create as unknown as Mock;
const enqueueMock = enqueuePublish as unknown as Mock;
const requireOwnerMock = requireOwner as unknown as Mock;

const req = () =>
  new Request("http://localhost:3000/api/content/c1/action", { method: "POST" });
const ctx = (contentId = "c1") => ({ params: Promise.resolve({ contentId }) });

beforeEach(() => {
  requireOwnerMock.mockReset().mockResolvedValue(true);
  findUnique.mockReset().mockResolvedValue(null);
  update.mockReset().mockResolvedValue({});
  deleteMany.mockReset().mockResolvedValue({ count: 1 });
  updateMany.mockReset().mockResolvedValue({ count: 1 });
  createJob.mockReset().mockResolvedValue({});
  enqueueMock.mockReset().mockResolvedValue(undefined);
});

describe("approve (FR-015)", () => {
  it("PENDING → APPROVED and enqueues a job", async () => {
    findUnique.mockResolvedValue({ id: "c1", status: "PENDING" });

    const res = await approve(req(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "APPROVED" });

    expect(update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { status: "APPROVED" } });
    expect(enqueueMock).toHaveBeenCalledWith("c1");
  });

  it("non-PENDING → 409, no status change, no enqueue", async () => {
    findUnique.mockResolvedValue({ id: "c1", status: "PUBLISHED" });

    const res = await approve(req(), ctx());
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("404 when content is missing", async () => {
    const res = await approve(req(), ctx());
    expect(res.status).toBe(404);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("401 unauthenticated (no DB, no enqueue)", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await approve(req(), ctx());
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});

describe("reject (FR-015 — MUST never publish)", () => {
  it("sets REJECTED, cancels any queued job, and NEVER enqueues", async () => {
    findUnique.mockResolvedValue({ id: "c1", status: "PENDING" });

    const res = await reject(req(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "REJECTED" });

    expect(update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { status: "REJECTED" } });
    expect(deleteMany).toHaveBeenCalledWith({ where: { contentId: "c1", status: "QUEUED" } });
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("cannot reject a PUBLISHED item → 409", async () => {
    findUnique.mockResolvedValue({ id: "c1", status: "PUBLISHED" });
    const res = await reject(req(), ctx());
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("401 unauthenticated", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await reject(req(), ctx());
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("retry (FR-026)", () => {
  it("FAILED → APPROVED and resets the job (attempts/nextRunAt), requeued", async () => {
    findUnique.mockResolvedValue({ id: "c1", status: "FAILED" });
    updateMany.mockResolvedValue({ count: 1 });

    const res = await retry(req(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "APPROVED", requeued: true });

    expect(update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { status: "APPROVED" } });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contentId: "c1" },
        data: expect.objectContaining({ status: "QUEUED", attempts: 0, lastError: null }),
      }),
    );
    expect(createJob).not.toHaveBeenCalled();
  });

  it("creates a fresh job when none exists to reset", async () => {
    findUnique.mockResolvedValue({ id: "c1", status: "FAILED" });
    updateMany.mockResolvedValue({ count: 0 });

    const res = await retry(req(), ctx());
    expect(res.status).toBe(200);
    expect(createJob).toHaveBeenCalled();
  });

  it("non-FAILED → 409 (no job reset)", async () => {
    findUnique.mockResolvedValue({ id: "c1", status: "PENDING" });
    const res = await retry(req(), ctx());
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("401 unauthenticated", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await retry(req(), ctx());
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("mark-published (manual publishing)", () => {
  it("MANUAL_REQUIRED → PUBLISHED", async () => {
    findUnique.mockResolvedValue({ id: "c1", status: "MANUAL_REQUIRED" });

    const res = await markPublished(req(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "PUBLISHED" });
    expect(update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { status: "PUBLISHED" } });
  });

  it("non-MANUAL_REQUIRED → 409, no status change", async () => {
    findUnique.mockResolvedValue({ id: "c1", status: "PENDING" });
    const res = await markPublished(req(), ctx());
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("404 when content is missing", async () => {
    const res = await markPublished(req(), ctx());
    expect(res.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it("401 unauthenticated (no DB)", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await markPublished(req(), ctx());
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
