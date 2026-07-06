import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB boundary and the owner-session guard (auth has its own tests).
vi.mock("@/lib/prisma", () => ({
  prisma: {
    wordPressPost: { findMany: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/oauth/session", () => ({ requireOwner: vi.fn() }));

import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";
import { GET as getPost } from "@/app/api/posts/[postId]/route";
import { GET as listPosts } from "@/app/api/posts/route";

const findMany = prisma.wordPressPost.findMany as unknown as Mock;
const findUnique = prisma.wordPressPost.findUnique as unknown as Mock;
const requireOwnerMock = requireOwner as unknown as Mock;

const req = (path = "http://localhost:3000/api/posts") => new Request(path);
const detailContext = (postId: string) => ({ params: Promise.resolve({ postId }) });

beforeEach(() => {
  requireOwnerMock.mockReset().mockResolvedValue(true);
  findMany.mockReset().mockResolvedValue([]);
  findUnique.mockReset().mockResolvedValue(null);
});

describe("GET /api/posts (FR-022/024)", () => {
  it("returns posts with correct per-platform { platform, contentId, status }", async () => {
    findMany.mockResolvedValue([
      {
        id: "wp-1",
        title: "All About Widgets",
        url: "https://blog.example.com/widgets",
        receivedAt: new Date("2026-06-01T10:00:00.000Z"),
        generatedContent: [
          { id: "gc-li", platform: "LINKEDIN", status: "PUBLISHED" },
          { id: "gc-x", platform: "X", status: "FAILED" },
        ],
      },
    ]);

    const res = await listPosts(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;

    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: "wp-1",
      title: "All About Widgets",
      url: "https://blog.example.com/widgets",
      receivedAt: "2026-06-01T10:00:00.000Z",
    });
    expect(body[0]?.platforms).toEqual([
      { platform: "LINKEDIN", contentId: "gc-li", status: "PUBLISHED" },
      { platform: "X", contentId: "gc-x", status: "FAILED" },
    ]);
  });

  it("does not expose content bodies in the list view", async () => {
    findMany.mockResolvedValue([
      {
        id: "wp-1",
        title: "t",
        url: "u",
        receivedAt: new Date(0),
        generatedContent: [{ id: "gc", platform: "FACEBOOK", status: "PENDING" }],
      },
    ]);
    const res = await listPosts(req());
    const raw = await res.text();
    expect(raw).not.toContain('"body"');
  });

  it("401 without an owner session (and never queries the DB)", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await listPosts(req());
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/posts/[postId] (FR-023)", () => {
  it("returns the post plus per-platform previews with correct statuses", async () => {
    findUnique.mockResolvedValue({
      id: "wp-1",
      title: "All About Widgets",
      url: "https://blog.example.com/widgets",
      generatedContent: [
        {
          id: "gc-ig",
          platform: "INSTAGRAM",
          status: "PENDING",
          body: "Visual hook about widgets.",
          hashtags: ["#widgets"],
          link: "https://blog.example.com/widgets",
          charCount: 1320,
        },
        {
          id: "gc-yt",
          platform: "YOUTUBE",
          status: "MANUAL_REQUIRED",
          body: "Watch: widgets explained.",
          hashtags: [],
          link: "https://blog.example.com/widgets",
          charCount: 25,
        },
      ],
    });

    const res = await getPost(req("http://localhost:3000/api/posts/wp-1"), detailContext("wp-1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      content: Array<Record<string, unknown>>;
    };

    expect(body.id).toBe("wp-1");
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "wp-1" } }),
    );
    expect(body.content).toHaveLength(2);
    expect(body.content[0]).toEqual({
      contentId: "gc-ig",
      platform: "INSTAGRAM",
      status: "PENDING",
      body: "Visual hook about widgets.",
      hashtags: ["#widgets"],
      link: "https://blog.example.com/widgets",
      charCount: 1320,
      publishedUrl: null,
    });
    expect(body.content[1]?.status).toBe("MANUAL_REQUIRED");
  });

  it("builds publishedUrl from the latest successful publish id", async () => {
    findUnique.mockResolvedValue({
      id: "wp-1",
      title: "t",
      url: "u",
      generatedContent: [
        {
          id: "gc-fb",
          platform: "FACEBOOK",
          status: "PUBLISHED",
          body: "b",
          hashtags: [],
          link: "u",
          charCount: 1,
          auditLogs: [{ externalId: "515_123" }],
        },
      ],
    });

    const res = await getPost(req("http://localhost:3000/api/posts/wp-1"), detailContext("wp-1"));
    const body = (await res.json()) as { content: Array<{ publishedUrl: string | null }> };
    expect(body.content[0]?.publishedUrl).toBe("https://www.facebook.com/515_123");
  });

  it("404 when the post does not exist", async () => {
    findUnique.mockResolvedValue(null);
    const res = await getPost(req("http://localhost:3000/api/posts/missing"), detailContext("missing"));
    expect(res.status).toBe(404);
  });

  it("401 without an owner session (and never queries the DB)", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await getPost(req("http://localhost:3000/api/posts/wp-1"), detailContext("wp-1"));
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
