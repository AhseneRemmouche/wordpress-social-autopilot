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

vi.mock("@/lib/oauth/tokens", () => ({
  getValidAccessToken: vi.fn(),
  refreshAccessToken: vi.fn(),
  TokenError: class TokenError extends Error {},
}));

import { getValidAccessToken } from "@/lib/oauth/tokens";
import { facebookPublisher } from "@/lib/publishers/facebook";

const getTokenMock = getValidAccessToken as unknown as Mock;
let fetchMock: Mock;

const ACCOUNT = {
  platform: "FACEBOOK",
  fbPageId: "page-123",
  accessToken: "encrypted",
  status: "CONNECTED",
} as PlatformAccount;

const CONTENT = {
  platform: "FACEBOOK",
  postId: "post-1",
  body: "Our new guide is live!\n\nhttps://blog.example.com/guide",
  link: "https://blog.example.com/guide",
  hashtags: ["#news", "#guide"],
} as GeneratedContent;

function json(obj: unknown): Response {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  getTokenMock.mockReset().mockResolvedValue("token-123");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("facebookPublisher (Principle III / VII, FR-010)", () => {
  it("exposes the correct platform and capabilities", () => {
    expect(facebookPublisher.platform).toBe("FACEBOOK");
    expect(facebookPublisher.capabilities).toEqual({
      autoPublish: true,
      requiresMedia: false,
    });
  });

  it("publishes to /{page-id}/feed with message + link and returns the post id", async () => {
    fetchMock.mockResolvedValue(json({ id: "page-123_456" }));

    const result = await facebookPublisher.publish(CONTENT, ACCOUNT);

    expect(result).toEqual({ ok: true, externalId: "page-123_456" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://graph.facebook.com/v25.0/page-123/feed",
    );

    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get("link")).toBe(CONTENT.link);
    expect(body.get("message")).toContain("guide is live");
    expect(body.get("message")).toContain("#news");
    expect(body.get("access_token")).toBe("token-123");
  });

  it("returns retryable on a 429 rate-limit", async () => {
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 429 }));
    const result = await facebookPublisher.publish(CONTENT, ACCOUNT);
    expect(result).toEqual({
      ok: false,
      retryable: true,
      error: expect.stringContaining("429"),
    });
  });

  it("returns non-retryable on a permanent (400) failure, secret-free", async () => {
    fetchMock.mockResolvedValue(new Response("bad request", { status: 400 }));
    const result = await facebookPublisher.publish(CONTENT, ACCOUNT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.error).toContain("400");
      expect(result.error).not.toContain("token-123");
    }
  });

  it("treats 5xx as retryable", async () => {
    fetchMock.mockResolvedValue(new Response("server error", { status: 500 }));
    const result = await facebookPublisher.publish(CONTENT, ACCOUNT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryable).toBe(true);
  });

  it("token expiry (401) → non-retryable reconnect (Meta tokens do not refresh)", async () => {
    fetchMock.mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const result = await facebookPublisher.publish(CONTENT, ACCOUNT);
    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: expect.stringContaining("reconnect"),
    });
  });

  it("fails fast (no fetch) when the Page id is missing", async () => {
    const noPage = { ...ACCOUNT, fbPageId: null } as PlatformAccount;
    const result = await facebookPublisher.publish(CONTENT, noPage);

    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: expect.stringContaining("Page id"),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
