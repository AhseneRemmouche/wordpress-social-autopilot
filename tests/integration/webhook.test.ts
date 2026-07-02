import { createHmac } from "node:crypto";

import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the external boundaries — DB and the NovaMira MCP call — so the route's
// logic (verify + schema + backfill + dedupe) is tested deterministically.
vi.mock("@/lib/prisma", () => ({
  prisma: { wordPressPost: { findUnique: vi.fn(), create: vi.fn() } },
}));
vi.mock("@/lib/wordpress/novamira", () => ({
  fetchFullPost: vi.fn(),
  NovaMiraError: class NovaMiraError extends Error {},
}));

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { fetchFullPost } from "@/lib/wordpress/novamira";
import { POST } from "@/app/api/webhooks/wordpress/route";

const findUnique = prisma.wordPressPost.findUnique as unknown as Mock;
const create = prisma.wordPressPost.create as unknown as Mock;
const fetchFullPostMock = fetchFullPost as unknown as Mock;

const COMPLETE = {
  wpPostId: "1234",
  event: "post_published",
  title: "Hello World",
  content: "The full body content of the post.",
  excerpt: "An excerpt",
  featuredImageUrl: "https://blog.example.com/img.jpg",
  url: "https://blog.example.com/hello-world",
  categories: ["news"],
  tags: ["a"],
};

const FULL_POST = {
  wpPostId: "1234",
  title: "Hello World",
  content: "Backfilled body content.",
  excerpt: "An excerpt",
  featuredImageUrl: "https://blog.example.com/img.jpg",
  url: "https://blog.example.com/hello-world",
  categories: ["news"],
  tags: ["a"],
};

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", env.WEBHOOK_SECRET).update(body).digest("hex");
}

function makeRequest(body: string, signature?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature !== undefined) headers["x-wsa-signature"] = signature;
  return new Request("http://localhost/api/webhooks/wordpress", {
    method: "POST",
    body,
    headers,
  });
}

beforeEach(() => {
  findUnique.mockReset().mockResolvedValue(null);
  create.mockReset().mockResolvedValue({ id: "post-1" });
  fetchFullPostMock.mockReset().mockResolvedValue(FULL_POST);
});

describe("POST /api/webhooks/wordpress (FR-002/003/006, SC-003/SC-006)", () => {
  it("valid signature + complete payload → 202, persists post with generatedAt=null", async () => {
    const body = JSON.stringify(COMPLETE);
    const res = await POST(makeRequest(body, sign(body)));

    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ accepted: true, postId: "post-1" });

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0]?.[0]?.data;
    expect(data?.wpPostId).toBe("1234");
    expect(data?.generatedAt).toBeNull(); // generation deferred to the worker
    expect(data?.sourceComplete).toBe(true);
    expect(fetchFullPostMock).not.toHaveBeenCalled(); // no backfill needed
  });

  it("invalid signature → 401, nothing persisted", async () => {
    const body = JSON.stringify(COMPLETE);
    const res = await POST(makeRequest(body, "sha256=deadbeef"));

    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("tampered body → 401", async () => {
    const signature = sign(JSON.stringify(COMPLETE));
    const tampered = JSON.stringify({ ...COMPLETE, title: "Hijacked" });
    const res = await POST(makeRequest(tampered, signature));

    expect(res.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("missing signature header → 401", async () => {
    const res = await POST(makeRequest(JSON.stringify(COMPLETE)));
    expect(res.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("duplicate wpPostId → 200, no duplicate row created", async () => {
    findUnique.mockResolvedValue({ id: "existing-1" });
    const body = JSON.stringify(COMPLETE);
    const res = await POST(makeRequest(body, sign(body)));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ accepted: true, duplicate: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("incomplete payload → NovaMira backfill invoked, then 202", async () => {
    const { content: _content, ...incomplete } = COMPLETE;
    const body = JSON.stringify(incomplete);
    const res = await POST(makeRequest(body, sign(body)));

    expect(res.status).toBe(202);
    expect(fetchFullPostMock).toHaveBeenCalledTimes(1);
    expect(fetchFullPostMock).toHaveBeenCalledWith({
      wpPostId: "1234",
      url: "https://blog.example.com/hello-world",
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]?.data?.sourceComplete).toBe(false);
  });

  it("acknowledges in well under 2s (SC-003)", async () => {
    const body = JSON.stringify(COMPLETE);
    const start = Date.now();
    const res = await POST(makeRequest(body, sign(body)));
    const elapsedMs = Date.now() - start;

    expect(res.status).toBe(202);
    expect(elapsedMs).toBeLessThan(2000);
  });
});
