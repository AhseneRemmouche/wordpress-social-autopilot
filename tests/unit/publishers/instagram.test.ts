import type { GeneratedContent, PlatformAccount } from "@prisma/client";
import {
  type Mock,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { wordPressPost: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/oauth/tokens", () => ({
  getValidAccessToken: vi.fn(),
  refreshAccessToken: vi.fn(),
  TokenError: class TokenError extends Error {},
}));

import { getValidAccessToken } from "@/lib/oauth/tokens";
import { prisma } from "@/lib/prisma";
import { instagramPublisher } from "@/lib/publishers/instagram";

const findUniqueMock = prisma.wordPressPost.findUnique as unknown as Mock;
const getTokenMock = getValidAccessToken as unknown as Mock;
let fetchMock: Mock;

const ACCOUNT = {
  platform: "INSTAGRAM",
  igUserId: "ig-123",
  accessToken: "encrypted",
  status: "CONNECTED",
} as PlatformAccount;

const CONTENT = {
  platform: "INSTAGRAM",
  postId: "post-1",
  body: "Fresh basil changes everything 🌿",
  link: "https://blog.example.com/pesto",
  hashtags: ["#food", "#basil", "#recipe"],
} as GeneratedContent;

function json(obj: unknown): Response {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Default happy path: quota under limit, container created, publish succeeds. */
function stubHappyPath(quotaUsage = 5): void {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("content_publishing_limit")) {
      return Promise.resolve(json({ data: [{ quota_usage: quotaUsage }] }));
    }
    if (url.includes("/media_publish")) return Promise.resolve(json({ id: "17999" }));
    if (url.includes("/media")) return Promise.resolve(json({ id: "creation-123" }));
    return Promise.resolve(new Response("unexpected", { status: 500 }));
  });
}

beforeEach(() => {
  findUniqueMock.mockReset().mockResolvedValue({
    featuredImageUrl: "https://blog.example.com/pesto.jpg",
  });
  getTokenMock.mockReset().mockResolvedValue("token-123");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("instagramPublisher (Principle III / VII, FR-017)", () => {
  it("exposes the correct platform and capabilities", () => {
    expect(instagramPublisher.platform).toBe("INSTAGRAM");
    expect(instagramPublisher.capabilities).toEqual({
      autoPublish: true,
      requiresMedia: true,
    });
  });

  it("publishes via the two-step container flow and returns the media id", async () => {
    stubHappyPath();

    const result = await instagramPublisher.publish(CONTENT, ACCOUNT);

    expect(result).toEqual({ ok: true, externalId: "17999" });
    expect(fetchMock).toHaveBeenCalledTimes(3); // quota, create, publish

    // Step 1 — container create carries image_url + caption.
    const createUrl = fetchMock.mock.calls[1]?.[0] as string;
    expect(createUrl).toBe("https://graph.facebook.com/v25.0/ig-123/media");
    const createBody = fetchMock.mock.calls[1]?.[1]?.body as URLSearchParams;
    expect(createBody.get("image_url")).toBe("https://blog.example.com/pesto.jpg");
    expect(createBody.get("caption")).toContain("basil");
    expect(createBody.get("caption")).toContain("#food");

    // Step 2 — publish carries the creation_id from step 1.
    const publishUrl = fetchMock.mock.calls[2]?.[0] as string;
    expect(publishUrl).toBe("https://graph.facebook.com/v25.0/ig-123/media_publish");
    const publishBody = fetchMock.mock.calls[2]?.[1]?.body as URLSearchParams;
    expect(publishBody.get("creation_id")).toBe("creation-123");
  });

  it("skips (non-retryable) when the post has no featured image", async () => {
    findUniqueMock.mockResolvedValue({ featuredImageUrl: null });

    const result = await instagramPublisher.publish(CONTENT, ACCOUNT);

    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: expect.stringContaining("featured image"),
    });
    expect(getTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns non-retryable when the 25-posts/24h limit is reached", async () => {
    stubHappyPath(25);

    const result = await instagramPublisher.publish(CONTENT, ACCOUNT);

    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: expect.stringContaining("25-post"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the quota check, no create/publish
  });

  it("returns non-retryable on a permanent (400) container failure, secret-free", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("content_publishing_limit")) {
        return Promise.resolve(json({ data: [{ quota_usage: 0 }] }));
      }
      return Promise.resolve(new Response("bad request", { status: 400 }));
    });

    const result = await instagramPublisher.publish(CONTENT, ACCOUNT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.error).toContain("400");
      expect(result.error).not.toContain("token-123");
    }
  });

  it("token expiry (401) → non-retryable reconnect (Meta tokens do not refresh)", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("content_publishing_limit")) {
        return Promise.resolve(json({ data: [{ quota_usage: 0 }] }));
      }
      return Promise.resolve(new Response("unauthorized", { status: 401 }));
    });

    const result = await instagramPublisher.publish(CONTENT, ACCOUNT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.error).toContain("reconnect");
    }
  });

  it("treats a 5xx publish failure as retryable", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("content_publishing_limit")) {
        return Promise.resolve(json({ data: [{ quota_usage: 0 }] }));
      }
      if (url.includes("/media_publish")) {
        return Promise.resolve(new Response("server error", { status: 503 }));
      }
      return Promise.resolve(json({ id: "creation-123" }));
    });

    const result = await instagramPublisher.publish(CONTENT, ACCOUNT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryable).toBe(true);
  });

  it("fails fast (no prisma, no fetch) when the IG user id is missing", async () => {
    const noIg = { ...ACCOUNT, igUserId: null } as PlatformAccount;

    const result = await instagramPublisher.publish(CONTENT, noIg);

    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: expect.stringContaining("IG user id"),
    });
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
