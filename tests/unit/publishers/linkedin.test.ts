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
import { linkedinPublisher } from "@/lib/publishers/linkedin";

const getTokenMock = getValidAccessToken as unknown as Mock;
const refreshMock = refreshAccessToken as unknown as Mock;
let fetchMock: Mock;

const ACCOUNT = {
  platform: "LINKEDIN",
  externalAccountId: "urn:li:person:abc",
  accessToken: "encrypted",
  status: "CONNECTED",
} as PlatformAccount;

const CONTENT = {
  platform: "LINKEDIN",
  body: "Great read on scaling systems!\n\nhttps://blog.example.com/post",
  link: "https://blog.example.com/post",
  hashtags: ["#a", "#b", "#c"],
} as GeneratedContent;

function reqInit(callIndex: number): RequestInit | undefined {
  return fetchMock.mock.calls[callIndex]?.[1] as RequestInit | undefined;
}
function reqHeaders(callIndex: number): Record<string, string> {
  return (reqInit(callIndex)?.headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  getTokenMock.mockReset().mockResolvedValue("token-123");
  refreshMock.mockReset().mockResolvedValue("token-refreshed");
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

  it("publishes successfully (201) and returns the x-restli-id", async () => {
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

    const body = JSON.parse(reqInit(0)?.body as string) as {
      author: string;
      commentary: string;
      lifecycleState: string;
      content: { article: { source: string } };
    };
    expect(body.author).toBe("urn:li:person:abc");
    // commentary = body + hashtags, within the LinkedIn limit, backlink preserved.
    expect(body.commentary).toContain("scaling systems");
    expect(body.commentary).toContain("#a");
    expect(body.commentary).toContain(CONTENT.link);
    expect(body.content.article.source).toBe(CONTENT.link);
    expect(body.lifecycleState).toBe("PUBLISHED");
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
