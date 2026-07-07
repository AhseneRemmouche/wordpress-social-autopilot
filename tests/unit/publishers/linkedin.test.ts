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

import { getValidAccessToken, refreshAccessToken } from "@/lib/oauth/tokens";
import { prisma } from "@/lib/prisma";
import { linkedinPublisher } from "@/lib/publishers/linkedin";

const getTokenMock = getValidAccessToken as unknown as Mock;
const refreshMock = refreshAccessToken as unknown as Mock;
const findUniqueMock = prisma.wordPressPost.findUnique as unknown as Mock;
let fetchMock: Mock;

const ACCOUNT = {
  platform: "LINKEDIN",
  externalAccountId: "urn:li:person:abc",
  accessToken: "encrypted",
  status: "CONNECTED",
} as PlatformAccount;

const CONTENT = {
  platform: "LINKEDIN",
  postId: "post-1",
  body: "Great read on scaling systems!\n\nhttps://blog.example.com/post",
  link: "https://blog.example.com/post",
  hashtags: ["#a", "#b", "#c"],
} as GeneratedContent;

function json(obj: unknown): Response {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
function reqInit(callIndex: number): RequestInit | undefined {
  return fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;
}
function reqHeaders(callIndex: number): Record<string, string> {
  return (reqInit(callIndex)?.headers ?? {}) as Record<string, string>;
}
function reqBody<T>(callIndex: number): T {
  return JSON.parse(reqInit(callIndex)?.body as string) as T;
}

beforeEach(() => {
  getTokenMock.mockReset().mockResolvedValue("token-123");
  refreshMock.mockReset().mockResolvedValue("token-refreshed");
  // Default: no featured image → article/link post (keeps the base cases simple).
  findUniqueMock.mockReset().mockResolvedValue({ featuredImageUrl: null });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("linkedinPublisher (Principle III / VII)", () => {
  it("exposes the correct platform and capabilities", () => {
    expect(linkedinPublisher.platform).toBe("LINKEDIN");
    expect(linkedinPublisher.capabilities).toEqual({
      autoPublish: true,
      requiresMedia: false,
    });
  });

  it("no featured image → article/link post (201) returning the x-restli-id", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 201,
        headers: { "x-restli-id": "urn:li:share:123" },
      }),
    );

    const result = await linkedinPublisher.publish(CONTENT, ACCOUNT);

    expect(result).toEqual({ ok: true, externalId: "urn:li:share:123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.linkedin.com/rest/posts");

    const headers = reqHeaders(0);
    expect(headers["LinkedIn-Version"]).toBe("202606");
    expect(headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
    expect(headers.Authorization).toBe("Bearer token-123");

    const body = reqBody<{
      author: string;
      commentary: string;
      lifecycleState: string;
      content: { article: { source: string }; media?: unknown };
    }>(0);
    expect(body.author).toBe("urn:li:person:abc");
    // commentary = body + hashtags, within the LinkedIn limit, backlink preserved.
    expect(body.commentary).toContain("scaling systems");
    expect(body.commentary).toContain("#a");
    expect(body.commentary).toContain(CONTENT.link);
    expect(body.content.article.source).toBe(CONTENT.link);
    expect(body.content.media).toBeUndefined();
    expect(body.lifecycleState).toBe("PUBLISHED");
  });

  it("featured image → uploads it and posts native media (content.media.id)", async () => {
    findUniqueMock.mockResolvedValue({
      featuredImageUrl: "https://blog.example.com/img.jpg",
    });
    fetchMock
      // 1. initializeUpload → uploadUrl + image URN
      .mockResolvedValueOnce(
        json({ value: { uploadUrl: "https://upload.linkedin/xyz", image: "urn:li:image:IMG1" } }),
      )
      // 2. GET the image bytes from WordPress
      .mockResolvedValueOnce(
        new Response(new ArrayBuffer(8), { status: 200, headers: { "content-type": "image/jpeg" } }),
      )
      // 3. PUT the bytes to LinkedIn
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      // 4. POST the image post
      .mockResolvedValueOnce(
        new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:777" } }),
      );

    const result = await linkedinPublisher.publish(CONTENT, ACCOUNT);

    expect(result).toEqual({ ok: true, externalId: "urn:li:share:777" });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // initializeUpload registered against the author URN.
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.linkedin.com/rest/images?action=initializeUpload",
    );
    expect(reqBody<{ initializeUploadRequest: { owner: string } }>(0).initializeUploadRequest.owner).toBe(
      "urn:li:person:abc",
    );
    // Bytes fetched from the WP image URL and PUT to the upload URL.
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://blog.example.com/img.jpg");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://upload.linkedin/xyz");
    expect(reqInit(2)?.method).toBe("PUT");

    // Final post carries the image as media, not an article.
    expect(fetchMock.mock.calls[3]?.[0]).toBe("https://api.linkedin.com/rest/posts");
    const body = reqBody<{
      commentary: string;
      content: { media?: { id: string }; article?: unknown };
    }>(3);
    expect(body.content.media?.id).toBe("urn:li:image:IMG1");
    expect(body.content.article).toBeUndefined();
    expect(body.commentary).toContain(CONTENT.link); // backlink still in the caption
  });

  it("image upload failure → falls back to an article post (still publishes)", async () => {
    findUniqueMock.mockResolvedValue({
      featuredImageUrl: "https://blog.example.com/img.jpg",
    });
    fetchMock
      // initializeUpload fails → uploadImage returns null
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      // article post succeeds
      .mockResolvedValueOnce(
        new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:555" } }),
      );

    const result = await linkedinPublisher.publish(CONTENT, ACCOUNT);

    expect(result).toEqual({ ok: true, externalId: "urn:li:share:555" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = reqBody<{ content: { article?: { source: string }; media?: unknown } }>(1);
    expect(body.content.article?.source).toBe(CONTENT.link);
    expect(body.content.media).toBeUndefined();
  });

  it("returns retryable on a 429 rate-limit", async () => {
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 429 }));
    const result = await linkedinPublisher.publish(CONTENT, ACCOUNT);
    expect(result).toEqual({
      ok: false,
      retryable: true,
      error: expect.stringContaining("429"),
    });
  });

  it("refreshes the token on 401 and retries once (success)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { "x-restli-id": "urn:li:share:999" },
        }),
      );

    const result = await linkedinPublisher.publish(CONTENT, ACCOUNT);

    expect(refreshMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, externalId: "urn:li:share:999" });
    // The retry used the refreshed token.
    expect(reqHeaders(1).Authorization).toBe("Bearer token-refreshed");
  });

  it("returns non-retryable when the token refresh fails after a 401", async () => {
    fetchMock.mockResolvedValue(new Response("unauthorized", { status: 401 }));
    refreshMock.mockRejectedValue(new Error("refresh failed"));

    const result = await linkedinPublisher.publish(CONTENT, ACCOUNT);

    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: expect.stringContaining("reconnect"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retry after refresh failure
  });

  it("returns non-retryable on a permanent (400) failure, with no secret leak", async () => {
    fetchMock.mockResolvedValue(new Response("bad request", { status: 400 }));
    const result = await linkedinPublisher.publish(CONTENT, ACCOUNT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.error).toContain("400");
      expect(result.error).not.toContain("token-123"); // secret-free
    }
  });

  it("treats 5xx as retryable", async () => {
    fetchMock.mockResolvedValue(new Response("server error", { status: 503 }));
    const result = await linkedinPublisher.publish(CONTENT, ACCOUNT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryable).toBe(true);
  });

  it("fails fast (no fetch) when the author URN is missing", async () => {
    const noAuthor = { ...ACCOUNT, externalAccountId: null } as PlatformAccount;
    const result = await linkedinPublisher.publish(CONTENT, noAuthor);

    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: expect.stringContaining("author"),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
