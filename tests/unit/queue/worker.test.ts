import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ processJobMock: vi.fn(), generateMock: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    publishJob: { findMany: vi.fn(), updateMany: vi.fn() },
    wordPressPost: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/queue/process-job", () => ({ processJob: h.processJobMock }));
vi.mock("@/lib/ai/generate", () => ({ generateForPost: h.generateMock }));

import { prisma } from "@/lib/prisma";
import {
  reclaimStaleRunningJobs,
  runGenerationPass,
  runPublishPass,
  runTick,
} from "@/lib/queue/worker";

const findJobs = prisma.publishJob.findMany as unknown as Mock;
const updateJobs = prisma.publishJob.updateMany as unknown as Mock;
const findPosts = prisma.wordPressPost.findMany as unknown as Mock;

beforeEach(() => {
  findJobs.mockReset().mockResolvedValue([]);
  updateJobs.mockReset().mockResolvedValue({ count: 0 });
  findPosts.mockReset().mockResolvedValue([]);
  h.processJobMock.mockReset().mockResolvedValue(undefined);
  h.generateMock.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {}); // silence per-item error logs
  vi.spyOn(console, "warn").mockImplementation(() => {}); // silence reclaim log
});

describe("runPublishPass (FR-030 — per-job isolation)", () => {
  it("drains every due job even when one throws, and counts the failure", async () => {
    findJobs.mockResolvedValue([{ id: "j1" }, { id: "j2" }, { id: "j3" }]);
    h.processJobMock.mockImplementation((id: string) =>
      id === "j2" ? Promise.reject(new Error("boom")) : Promise.resolve("published"),
    );

    const res = await runPublishPass();

    expect(res.processed).toBe(3);
    expect(res.failed).toBe(1); // j2 threw → counted as a failure
    expect(h.processJobMock).toHaveBeenCalledTimes(3);
    expect(h.processJobMock).toHaveBeenCalledWith("j3"); // ran despite j2 throwing
  });

  it('counts jobs whose processJob returns "failed"', async () => {
    findJobs.mockResolvedValue([{ id: "j1" }, { id: "j2" }]);
    h.processJobMock.mockImplementation((id: string) =>
      Promise.resolve(id === "j1" ? "failed" : "published"),
    );

    const res = await runPublishPass();

    expect(res).toEqual({ processed: 2, failed: 1 });
  });

  it("selects only due QUEUED jobs (status QUEUED, nextRunAt <= now)", async () => {
    await runPublishPass();
    const arg = findJobs.mock.calls[0]?.[0];
    expect(arg.where.status).toBe("QUEUED");
    expect(arg.where.nextRunAt.lte).toBeInstanceOf(Date);
  });
});

describe("runGenerationPass (FR-030 — per-post isolation)", () => {
  it("processes every pending post even when one throws", async () => {
    findPosts.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    h.generateMock.mockImplementation((post: { id: string }) =>
      post.id === "p1" ? Promise.reject(new Error("gen boom")) : Promise.resolve(),
    );

    const count = await runGenerationPass();

    expect(count).toBe(2);
    expect(h.generateMock).toHaveBeenCalledTimes(2);
  });

  it("selects only not-yet-generated posts (generatedAt IS NULL)", async () => {
    await runGenerationPass();
    const arg = findPosts.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ generatedAt: null });
  });

  it("stops starting work once the deadline has passed (budget guard)", async () => {
    findPosts.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    const count = await runGenerationPass(25, Date.now() - 1); // deadline already past
    expect(count).toBe(0);
    expect(h.generateMock).not.toHaveBeenCalled(); // no post started past the budget
  });
});

describe("runPublishPass — budget", () => {
  it("stops draining once the deadline has passed", async () => {
    findJobs.mockResolvedValue([{ id: "j1" }, { id: "j2" }]);
    const res = await runPublishPass(50, Date.now() - 1);
    expect(res).toEqual({ processed: 0, failed: 0 });
    expect(h.processJobMock).not.toHaveBeenCalled();
  });
});

describe("reclaimStaleRunningJobs (visibility timeout)", () => {
  it("resets RUNNING jobs older than the stale threshold back to QUEUED", async () => {
    updateJobs.mockResolvedValue({ count: 2 });

    const reclaimed = await reclaimStaleRunningJobs();

    expect(reclaimed).toBe(2);
    const arg = updateJobs.mock.calls[0]?.[0];
    expect(arg.where.status).toBe("RUNNING");
    expect(arg.where.updatedAt.lt).toBeInstanceOf(Date); // only jobs stale past the cutoff
    expect(arg.data.status).toBe("QUEUED");
  });

  it("runPublishPass reclaims stale RUNNING jobs before selecting due work", async () => {
    await runPublishPass();

    expect(updateJobs).toHaveBeenCalledTimes(1); // reclaim ran
    const reclaimArg = updateJobs.mock.calls[0]?.[0];
    expect(reclaimArg.where.status).toBe("RUNNING");
    expect(findJobs).toHaveBeenCalledTimes(1); // then the normal QUEUED selection
  });
});

describe("runTick", () => {
  it("runs the generation then publish passes and returns the counts", async () => {
    findPosts.mockResolvedValue([{ id: "p1" }]);
    findJobs.mockResolvedValue([{ id: "j1" }, { id: "j2" }]);
    h.processJobMock.mockResolvedValue("published");

    const result = await runTick();

    expect(result).toEqual({ generated: 1, published: 2, failed: 0 });
  });

  it("includes the failed count from the publish pass", async () => {
    findPosts.mockResolvedValue([]);
    findJobs.mockResolvedValue([{ id: "j1" }, { id: "j2" }]);
    h.processJobMock.mockImplementation((id: string) =>
      Promise.resolve(id === "j1" ? "failed" : "published"),
    );

    const result = await runTick();

    expect(result).toEqual({ generated: 0, published: 2, failed: 1 });
  });
});
