import type { GeneratedContent, PlatformAccount } from "@prisma/client";
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { youtubePublisher } from "@/lib/publishers/youtube";

let fetchMock: Mock;

const CONTENT = {
  platform: "YOUTUBE",
  postId: "post-1",
  body: "New video companion post",
  link: "https://blog.example.com/vid",
  hashtags: ["#youtube"],
} as GeneratedContent;

const ACCOUNT = { platform: "YOUTUBE", status: "CONNECTED" } as PlatformAccount;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("youtubePublisher (Principle III / VII — manual-only)", () => {
  it("declares itself non-auto-publishing", () => {
    expect(youtubePublisher.platform).toBe("YOUTUBE");
    expect(youtubePublisher.capabilities).toEqual({
      autoPublish: false,
      requiresMedia: false,
    });
  });

  it("always returns the non-retryable manual-required result with no network call", async () => {
    const result = await youtubePublisher.publish(CONTENT, ACCOUNT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
      expect(result.error).toMatch(/manual|no public write api/i);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
