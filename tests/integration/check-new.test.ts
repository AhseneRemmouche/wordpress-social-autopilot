import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

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
  findMany.mockReset().mockResolvedValue([]); // nothing known yet
  findUnique.mockReset();
  latestMock.mockReset();
  fullMock.mockReset();
  createIfNewMock.mockReset();
  generateMock.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/posts/check-new", () => {
  it("401 when not the owner — no WP calls", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await POST(req());

    expect(res.status).toBe(401);
    expect(latestMock).not.toHaveBeenCalled();
  });

  it("imports + generates only the posts not already stored", async () => {
    latestMock.mockResolvedValue([
      { wpPostId: "42025", url: "https://mlscampus.com/42025" },
      { wpPostId: "42023", url: "https://mlscampus.com/42023" },
    ]);
    // 42023 is already stored; only 42025 is fresh.
    findMany.mockResolvedValue([{ wpPostId: "42023" }]);
    fullMock.mockImplementation(({ wpPostId }: { wpPostId: string }) =>
      Promise.resolve(fullPost(wpPostId, "Latest Blog")),
    );
    createIfNewMock.mockResolvedValue({ postId: "row-42025", created: true });
    findUnique.mockResolvedValue({ id: "row-42025", title: "Latest Blog" });

    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toMatchObject({ checked: 2, count: 1 });
    expect(body.imported).toEqual([{ postId: "row-42025", title: "Latest Blog" }]);
    // Only the fresh id was backfilled + generated.
    expect(fullMock).toHaveBeenCalledTimes(1);
    expect(fullMock).toHaveBeenCalledWith({
      wpPostId: "42025",
      url: "https://mlscampus.com/42025",
    });
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it("reports zero when every latest post is already known", async () => {
    latestMock.mockResolvedValue([
      { wpPostId: "42025", url: "https://mlscampus.com/42025" },
    ]);
    findMany.mockResolvedValue([{ wpPostId: "42025" }]);

    const res = await POST(req());
    const body = await res.json();

    expect(body).toMatchObject({ checked: 1, count: 0, imported: [] });
    expect(fullMock).not.toHaveBeenCalled();
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("does not generate when the post already existed (created:false)", async () => {
    latestMock.mockResolvedValue([
      { wpPostId: "42025", url: "https://mlscampus.com/42025" },
    ]);
    findMany.mockResolvedValue([]); // not seen in the pre-check…
    fullMock.mockResolvedValue(fullPost("42025"));
    // …but createPostIfNew reports it as a concurrent/known duplicate.
    createIfNewMock.mockResolvedValue({ postId: "row-x", created: false });

    const res = await POST(req());
    const body = await res.json();

    expect(body).toMatchObject({ count: 0 });
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("502 when WordPress cannot be reached", async () => {
    latestMock.mockRejectedValue(new Error("network"));
    const res = await POST(req());
    expect(res.status).toBe(502);
  });

  it("isolates a per-post failure and still returns 200 for the rest", async () => {
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
    createIfNewMock.mockResolvedValue({ postId: "row-2", created: true });
    findUnique.mockResolvedValue({ id: "row-2", title: "Post 2" });

    const res = await POST(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ checked: 2, count: 1 });
    expect(generateMock).toHaveBeenCalledTimes(1);
  });
});
