import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock every external boundary: DB, WP fetches, ingest, generation, owner guard.
vi.mock("@/lib/prisma", () => ({
  prisma: { wordPressPost: { findMany: vi.fn(), findUnique: vi.fn() } },
}));
vi.mock("@/lib/wordpress/novamira", () => ({
  fetchLatestPostIds: vi.fn(),
  fetchFullPost: vi.fn(),
}));
vi.mock("@/lib/wordpress/ingest", () => ({ createPostIfNew: vi.fn() }));
vi.mock("@/lib/ai/generate", () => ({ generateForPost: vi.fn() }));
vi.mock("@/lib/oauth/session", () => ({ requireOwner: vi.fn() }));

import { generateForPost } from "@/lib/ai/generate";
import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";
import { createPostIfNew } from "@/lib/wordpress/ingest";
import { fetchFullPost, fetchLatestPostIds } from "@/lib/wordpress/novamira";
import { POST } from "@/app/api/posts/check-new/route";

const findMany = prisma.wordPressPost.findMany as unknown as Mock;
const findUnique = prisma.wordPressPost.findUnique as unknown as Mock;
const latestMock = fetchLatestPostIds as unknown as Mock;
const fullMock = fetchFullPost as unknown as Mock;
const createIfNewMock = createPostIfNew as unknown as Mock;
const generateMock = generateForPost as unknown as Mock;
const requireOwnerMock = requireOwner as unknown as Mock;

const req = () =>
  new Request("http://localhost/api/posts/check-new", { method: "POST" });

function fullPost(wpPostId: string, title = `Post ${wpPostId}`) {
  return {
    wpPostId,
    title,
    content: "Body.",
    excerpt: "",
    featuredImageUrl: null,
    url: `https://mlscampus.com/${wpPostId}`,
    categories: [],
    tags: [],
  };
}

beforeEach(() => {
  requireOwnerMock.mockReset().mockResolvedValue(true);
  findMany.mockReset().mockResolvedValue([]); // nothing stored yet
  findUnique.mockReset().mockResolvedValue({ id: "row", generatedAt: null });
  latestMock.mockReset();
  fullMock.mockReset().mockImplementation(({ wpPostId }: { wpPostId: string }) =>
    Promise.resolve(fullPost(wpPostId)),
  );
  createIfNewMock.mockReset().mockResolvedValue({ postId: "row", created: true });
  generateMock.mockReset().mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("POST /api/posts/check-new", () => {
  it("401 when not the owner — no WP calls", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await POST(req());

    expect(res.status).toBe(401);
    expect(latestMock).not.toHaveBeenCalled();
  });

  it("imports + generates fresh posts (not in the DB)", async () => {
    latestMock.mockResolvedValue([
      { wpPostId: "42025", url: "https://mlscampus.com/42025" },
      { wpPostId: "42023", url: "https://mlscampus.com/42023" },
    ]);
    findMany.mockResolvedValue([]); // neither stored

    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      checked: 2,
      imported: 2,
      generated: 2,
      pending: 0,
    });
    expect(fullMock).toHaveBeenCalledTimes(2);
    expect(generateMock).toHaveBeenCalledTimes(2);
  });

  it("resumes an imported-but-ungenerated post WITHOUT re-importing it", async () => {
    latestMock.mockResolvedValue([
      { wpPostId: "42025", url: "https://mlscampus.com/42025" },
    ]);
    // Already stored, but generation never finished (orphan).
    findMany.mockResolvedValue([
      { id: "row-42025", wpPostId: "42025", generatedAt: null },
    ]);
    findUnique.mockResolvedValue({ id: "row-42025", generatedAt: null });

    const res = await POST(req());
    expect(await res.json()).toEqual({
      checked: 1,
      imported: 0,
      generated: 1,
      pending: 0,
    });
    // No re-import — it was already in the DB.
    expect(fullMock).not.toHaveBeenCalled();
    expect(createIfNewMock).not.toHaveBeenCalled();
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it("skips posts that are already fully processed", async () => {
    latestMock.mockResolvedValue([
      { wpPostId: "42025", url: "https://mlscampus.com/42025" },
    ]);
    findMany.mockResolvedValue([
      { id: "row-42025", wpPostId: "42025", generatedAt: new Date("2026-07-05") },
    ]);

    const res = await POST(req());
    expect(await res.json()).toEqual({
      checked: 1,
      imported: 0,
      generated: 0,
      pending: 0,
    });
    expect(fullMock).not.toHaveBeenCalled();
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("leaves work as `pending` (not generated) once the time budget is exceeded", async () => {
    // First Date.now() call = startedAt (0); every later call is way past budget.
    let calls = 0;
    vi.spyOn(Date, "now").mockImplementation(() => (calls++ === 0 ? 0 : 10_000_000));
    latestMock.mockResolvedValue([
      { wpPostId: "42025", url: "https://mlscampus.com/42025" },
    ]);
    findMany.mockResolvedValue([]);

    const res = await POST(req());
    expect(await res.json()).toEqual({
      checked: 1,
      imported: 1, // still imported…
      generated: 0, // …but not generated (over budget)
      pending: 1,
    });
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("502 when WordPress cannot be reached", async () => {
    latestMock.mockRejectedValue(new Error("network"));
    const res = await POST(req());
    expect(res.status).toBe(502);
  });

  it("isolates a per-post failure as `pending` and still returns 200", async () => {
    latestMock.mockResolvedValue([
      { wpPostId: "1", url: "https://mlscampus.com/1" },
      { wpPostId: "2", url: "https://mlscampus.com/2" },
    ]);
    findMany.mockResolvedValue([]);
    fullMock.mockImplementation(({ wpPostId }: { wpPostId: string }) =>
      wpPostId === "1"
        ? Promise.reject(new Error("backfill failed"))
        : Promise.resolve(fullPost("2")),
    );

    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      checked: 2,
      imported: 1, // post "2" imported + generated
      generated: 1,
      pending: 1, // post "1" failed
    });
    expect(generateMock).toHaveBeenCalledTimes(1);
  });
});
