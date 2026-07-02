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

import { getValidAccessToken, refreshAccessToken } from "@/lib/oauth/tokens";
import { xPublisher } from "@/lib/publishers/x";

const getTokenMock = getValidAccessToken as unknown as Mock;
const refreshMock = refreshAccessToken as unknown as Mock;
let fetchMock: Mock;

const ACCOUNT = {
  platform: "X",
  accessToken: "encrypted",
  refreshToken: "encrypted-refresh",
  status: "CONNECTED",
} as PlatformAccount;

const CONTENT = {
  platform: "X",
  postId: "post-1",
  body: "Hot take on caching",
  link: "https://blog.example.com/cache",
  hashtags: ["#dev"],
} as GeneratedContent;

function json(obj: unknown, status = 201): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function reqInit(i: number): RequestInit | undefined {
  return fetchMock.mock.calls[i]?.[1] as RequestInit | undefined;
}
function authHeader(i: number): string | undefined {
  return ((reqInit(i)?.headers ?? {}) as Record<string, string>).Authorization;
}

beforeEach(() => {
  getTokenMock.mockReset().mockResolvedValue("token-123");
  refreshMock.mockReset().mockResolvedValue("token-rotated");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("xPublisher (Principle III / VII, FR-010)", () => {
  it("exposes the correct platform and capabilities", () => {
    expect(xPublisher.platform).toBe("X");
    expect(xPublisher.capabilities).toEqual({
      autoPublish: true,
      requiresMedia: false,
    });
  });

  it("publishes a tweet (201) with a <=280 char body and returns the id", async () => {
    fetchMock.mockResolvedValue(json({ data: { id: "tweet-1" } }));

    const result = await xPublisher.publish(CONTENT, ACCOUNT);

    expect(result).toEqual({ ok: true, externalId: "tweet-1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.x.com/2/tweets");
    expect(authHeader(0)).toBe("Bearer token-123");

    const body = JSON.parse(reqInit(0)?.body as string) as { text: string };
    expect(body.text).toContain("caching");
    expect(body.text).toContain(CONTENT.link);
    expect(body.text.length).toBeLessThanOrEqual(280);
  });

  it("refreshes+rotates the token on 401 and retries once (success)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(json({ data: { id: "tweet-2" } }));

    const result = await xPublisher.publish(CONTENT, ACCOUNT);

    expect(refreshMock).toHaveBeenCalledOnce();
    expect(refreshMock).toHaveBeenCalledWith(ACCOUNT); // rotation persisted by tokens.ts
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, externalId: "tweet-2" });
    expect(authHeader(1)).toBe("Bearer token-rotated"); // retry used the rotated token
  });

  it("returns non-retryable when the refresh fails after a 401", async () => {
    fetchMock.mockResolvedValue(new Response("unauthorized", { status: 401 }));
    refreshMock.mockRejectedValue(new Error("refresh failed"));

    const result = await xPublisher.publish(CONTENT, ACCOUNT);

    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: expect.stringContaining("reconnect"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns retryable on a 429 rate-limit", async () => {
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 429 }));
    const result = await xPublisher.publish(CONTENT, ACCOUNT);
    expect(result).toEqual({
      ok: false,
      retryable: true,
      error: expect.stringContaining("429"),
    });
  });

  it("returns non-retryable on a permanent (403) failure, secret-free", async () => {
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));
    const result = await xPublisher.publish(CONTENT, ACCOUNT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.error).toContain("403");
      expect(result.error).not.toContain("token-123");
    }
  });

  it("treats 5xx as retryable", async () => {
    fetchMock.mockResolvedValue(new Response("server error", { status: 500 }));
    const result = await xPublisher.publish(CONTENT, ACCOUNT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryable).toBe(true);
  });
});
