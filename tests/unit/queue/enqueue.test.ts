import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { publishJob: { findFirst: vi.fn(), create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { enqueuePublish } from "@/lib/queue/enqueue";

const findFirst = prisma.publishJob.findFirst as unknown as Mock;
const create = prisma.publishJob.create as unknown as Mock;

beforeEach(() => {
  findFirst.mockReset().mockResolvedValue(null);
  create.mockReset().mockResolvedValue({});
});

describe("enqueuePublish (idempotent enqueue)", () => {
  it("creates a job when the content has no live job", async () => {
    await enqueuePublish("gc-1");
    expect(create).toHaveBeenCalledWith({ data: { content: { connect: { id: "gc-1" } } } });
    // Only QUEUED/RUNNING count as "live".
    const where = findFirst.mock.calls[0]?.[0]?.where;
    expect(where.contentId).toBe("gc-1");
    expect(where.status.in).toEqual(["QUEUED", "RUNNING"]);
  });

  it("is a no-op when a live (QUEUED/RUNNING) job already exists — no duplicate", async () => {
    findFirst.mockResolvedValue({ id: "job-existing" });
    await enqueuePublish("gc-1");
    expect(create).not.toHaveBeenCalled();
  });
});
