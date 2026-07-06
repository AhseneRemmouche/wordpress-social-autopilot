import type { Platform } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildPostUrl, publishHubUrl } from "@/lib/publishers/post-url";

describe("buildPostUrl", () => {
  it("builds a Facebook post URL from the {pageId}_{postId} id", () => {
    expect(buildPostUrl("FACEBOOK", "515639451795883_123")).toBe(
      "https://www.facebook.com/515639451795883_123",
    );
  });

  it("builds a LinkedIn feed URL from the share URN", () => {
    expect(buildPostUrl("LINKEDIN", "urn:li:share:7123")).toBe(
      "https://www.linkedin.com/feed/update/urn:li:share:7123",
    );
  });

  it("builds an X status URL from the tweet id", () => {
    expect(buildPostUrl("X", "1800000000000000000")).toBe(
      "https://x.com/i/web/status/1800000000000000000",
    );
  });

  it("returns null for platforms without a deterministic public URL", () => {
    for (const p of ["INSTAGRAM", "TIKTOK", "YOUTUBE"] as Platform[]) {
      expect(buildPostUrl(p, "someid")).toBeNull();
    }
  });

  it("returns null when the external id is missing or blank", () => {
    expect(buildPostUrl("FACEBOOK", null)).toBeNull();
    expect(buildPostUrl("FACEBOOK", undefined)).toBeNull();
    expect(buildPostUrl("FACEBOOK", "   ")).toBeNull();
  });
});

describe("publishHubUrl", () => {
  it("points YouTube to Studio and TikTok to the upload page", () => {
    expect(publishHubUrl("YOUTUBE")).toBe("https://studio.youtube.com");
    expect(publishHubUrl("TIKTOK")).toBe("https://www.tiktok.com/tiktokstudio/upload");
  });

  it("returns null for the auto-publishing platforms", () => {
    for (const p of ["FACEBOOK", "LINKEDIN", "X", "INSTAGRAM"] as Platform[]) {
      expect(publishHubUrl(p)).toBeNull();
    }
  });
});
