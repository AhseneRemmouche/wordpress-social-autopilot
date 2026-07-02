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
import { tiktokPublisher } from "@/lib/publishers/tiktok";

const findUniqueMock = prisma.wordPressPost.findUnique as unknown as Mock;
const getTokenMock = getValidAccessToken as unknown as Mock;
const refreshMock = refreshAccessToken as unknown as Mock;
let fetchMock: Mock;

const ACCOUNT = {
  platform: "TIKTOK",
  accessToken: "encrypted",
  refreshToken: "encrypted-refresh",
  status: "CONNECTED",
} as PlatformAccount;

const CONTENT = {
  platform: "TIKTOK",
  postId: "post-1",
  body: "Dance trends 2026",
  link: "https://blog.example.com/dance",
  hashtags: ["#tok", "#dance"],
} as GeneratedContent;

function json(obj: unknown, status = 200): Response {
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
  findUniqueMock.mockReset().mockResolvedValue({
    featuredImageUrl: "https://blog.example.com/dance.jpg",
  });
  getTokenMock.mockReset().mockResolvedValue("token-123");
  refreshMock.mockReset().mockResolvedValue("token-rotated");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tiktokPublisher (Principle III / VII, FR-010/FR-017)", () => {
  it("exposes the correct platform and capabilities", () => {
    expect(tiktokPublisher.platform).toBe("TIKTOK");
    expect(tiktokPublisher.capabilities).toEqual({
      autoPublish: true,
      requiresMedia: true,
    });
  });

  it("initializes a photo draft (code ok) and returns the publish_id", async () => {
    fetchMock.mockResolvedValue(
      json({ data: { publish_id: "p_pub_url~v2.99" }, error: { code: "ok" } }),
    );

    const result = await tiktokPublisher.publish(CONTENT, ACCOUNT);

    expect(result).toEqual({ ok: true, externalId: "p_pub_url~v2.99" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://open.tiktokapis.com/v2/post/publish/content/init/",
    );
    expect(authHeader(0)).toBe("Bearer token-123");

    const body = JSON.parse(reqInit(0)?.body as string) as {
      media_type: string;
      post_mode: string;
      post_info: { description: string };
      source_info: { source: string; photo_images: string[] };
    };
    expect(body.media_type).toBe("PHOTO");
    expect(body.post_mode).toBe("MEDIA_UPLOAD");
    expect(body.source_info.source).toBe("PULL_FROM_URL");
    expect(body.source_info.photo_images[0]).toBe("https://blog.example.com/dance.jpg");
    expect(body.post_info.description).toContain("#tok");
  });

  it("skips (non-retryable) when the post has no featured image", async () => {
    findUniqueMock.mockResolvedValue({ featuredImageUrl: null });

    const result = await tiktokPublisher.publish(CONTENT, ACCOUNT);

    expect(result).toEqual({
      ok: false,
      retryable: false,
      error: expect.stringContaining("featured image"),
    });
    expect(getTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes+rotates the token on 401 and retries once (success)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        json({ data: { publish_id: "p_pub_url~v2.retry" }, error: { code: "ok" } }),
      );

    const result = await tiktokPublisher.publish(CONTENT, ACCOUNT);

    expect(refreshMock).toHaveBeenCalledWith(ACCOUNT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, externalId: "p_pub_url~v2.retry" });
    expect(authHeader(1)).toBe("Bearer token-rotated");
  });

  it("treats a body-level rate-limit code (HTTP 200) as retryable", async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: "spam_risk_too_many_posts" } }, 200),
    );

    const result = await tiktokPublisher.publish(CONTENT, ACCOUNT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(true);
      expect(result.error).toContain("spam_risk_too_many_posts");
    }
  });

  it("returns non-retryable on a permanent error code, secret-free", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: "invalid_params" } }, 400));

    const result = await tiktokPublisher.publish(CONTENT, ACCOUNT);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.error).toContain("invalid_params");
      expect(result.error).not.toContain("token-123");
    }
  });

  it("treats HTTP 429 as retryable", async () => {
    fetchMock.mockResolvedValue(new Response("rate limited", { status: 429 }));
    const result = await tiktokPublisher.publish(CONTENT, ACCOUNT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryable).toBe(true);
  });
});
