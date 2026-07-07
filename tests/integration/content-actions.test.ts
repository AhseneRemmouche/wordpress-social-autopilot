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
vi.mock("@/lib/ai/generate", () => ({ regeneratePlatform: vi.fn() }));

import { regeneratePlatform } from "@/lib/ai/generate";
import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";
import { enqueuePublish } from "@/lib/queue/enqueue";
import { PATCH as editContent } from "@/app/api/content/[contentId]/route";
import { POST as approve } from "@/app/api/content/[contentId]/approve/route";
import { POST as markPublished } from "@/app/api/content/[contentId]/mark-published/route";
import { POST as regenerate } from "@/app/api/content/[contentId]/regenerate/route";
import { POST as reject } from "@/app/api/content/[contentId]/reject/route";
import { POST as retry } from "@/app/api/content/[contentId]/retry/route";

const findUnique = prisma.generatedContent.findUnique as unknown as Mock;
const update = prisma.generatedContent.update as unknown as Mock;
const deleteMany = prisma.publishJob.deleteMany as unknown as Mock;
const updateMany = prisma.publishJob.updateMany as unknown as Mock;
const createJob = prisma.publishJob.create as unknown as Mock;
const enqueueMock = enqueuePublish as unknown as Mock;
const requireOwnerMock = requireOwner as unknown as Mock;
const regenMock = regeneratePlatform as unknown as Mock;

const req = () =>
  new Request("http://localhost:3000/api/content/c1/action", { method: "POST" });
const patchReq = (payload: unknown) =>
  new Request("http://localhost:3000/api/content/c1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
const ctx = (contentId = "c1") => ({ params: Promise.resolve({ contentId }) });

beforeEach(() => {
  requireOwnerMock.mockReset().mockResolvedValue(true);
  findUnique.mockReset().mockResolvedValue(null);
  update.mockReset().mockResolvedValue({});
  deleteMany.mockReset().mockResolvedValue({ count: 1 });
  updateMany.mockReset().mockResolvedValue({ count: 1 });
  createJob.mockReset().mockResolvedValue({});
  enqueueMock.mockReset().mockResolvedValue(undefined);
  regenMock.mockReset().mockResolvedValue({ ok: true, body: "fresh copy", hashtags: ["#x"], charCount: 10 });
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

describe("edit caption (PATCH)", () => {
  const editable = {
    status: "PENDING",
    platform: "LINKEDIN",
    link: "https://blog.example.com/p",
    hashtags: ["#a"],
  };

  it("overwrites the body, re-applies the limit, and recomputes charCount", async () => {
    findUnique.mockResolvedValue(editable);
    update.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(data));

    const res = await editContent(patchReq({ body: "A better caption" }), ctx());
    expect(res.status).toBe(200);

    const data = update.mock.calls[0]?.[0]?.data as { body: string; charCount: number; hashtags: string[] };
    expect(data.body).toContain("A better caption");
    expect(data.body).toContain("https://blog.example.com/p"); // backlink preserved
    expect(data.charCount).toBe(data.body.length);
    expect(data.hashtags).toEqual(["#a"]); // kept when omitted
  });

  it("accepts new hashtags when provided", async () => {
    findUnique.mockResolvedValue(editable);
    await editContent(patchReq({ body: "Hi", hashtags: ["#new"] }), ctx());
    expect(update.mock.calls[0]?.[0]?.data?.hashtags).toEqual(["#new"]);
  });

  it("cannot edit a PUBLISHED item → 409", async () => {
    findUnique.mockResolvedValue({ ...editable, status: "PUBLISHED" });
    const res = await editContent(patchReq({ body: "x" }), ctx());
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  it("400 on an empty body", async () => {
    findUnique.mockResolvedValue(editable);
    const res = await editContent(patchReq({ body: "" }), ctx());
    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("404 when content is missing", async () => {
    const res = await editContent(patchReq({ body: "x" }), ctx());
    expect(res.status).toBe(404);
  });

  it("401 unauthenticated (no DB)", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await editContent(patchReq({ body: "x" }), ctx());
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("regenerate (POST)", () => {
  it("PENDING → re-runs Claude and returns the fresh, PENDING copy", async () => {
    findUnique.mockResolvedValue({ status: "PENDING" });

    const res = await regenerate(req(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "PENDING",
      body: "fresh copy",
      hashtags: ["#x"],
      charCount: 10,
    });
    expect(regenMock).toHaveBeenCalledWith("c1");
  });

  it("FAILED is also regenerable", async () => {
    findUnique.mockResolvedValue({ status: "FAILED" });
    const res = await regenerate(req(), ctx());
    expect(res.status).toBe(200);
    expect(regenMock).toHaveBeenCalledOnce();
  });

  it("APPROVED/PUBLISHED → 409, does not regenerate", async () => {
    findUnique.mockResolvedValue({ status: "APPROVED" });
    const res = await regenerate(req(), ctx());
    expect(res.status).toBe(409);
    expect(regenMock).not.toHaveBeenCalled();
  });

  it("502 when the model fails", async () => {
    findUnique.mockResolvedValue({ status: "PENDING" });
    regenMock.mockResolvedValue({ ok: false, error: "Empty or unusable model output" });
    const res = await regenerate(req(), ctx());
    expect(res.status).toBe(502);
  });

  it("404 when content is missing", async () => {
    const res = await regenerate(req(), ctx());
    expect(res.status).toBe(404);
    expect(regenMock).not.toHaveBeenCalled();
  });

  it("401 unauthenticated (no DB, no regenerate)", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await regenerate(req(), ctx());
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(regenMock).not.toHaveBeenCalled();
  });
});
