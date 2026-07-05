import type { Platform } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { platformAutoRenews, providerSupportsRefresh } from "@/lib/oauth/config";

describe("platformAutoRenews (connections UI source of truth)", () => {
  it("auto-renews for the refresh-capable platforms (X, TikTok, YouTube)", () => {
    for (const platform of ["X", "TIKTOK", "YOUTUBE"] as Platform[]) {
      expect(platformAutoRenews(platform)).toBe(true);
    }
  });

  it("does NOT auto-renew for LinkedIn / Meta (they expire and need reconnect)", () => {
    for (const platform of ["LINKEDIN", "FACEBOOK", "INSTAGRAM"] as Platform[]) {
      expect(platformAutoRenews(platform)).toBe(false);
    }
  });
});

describe("providerSupportsRefresh", () => {
  it("is true only for X / TIKTOK / GOOGLE", () => {
    expect(providerSupportsRefresh("X")).toBe(true);
    expect(providerSupportsRefresh("TIKTOK")).toBe(true);
    expect(providerSupportsRefresh("GOOGLE")).toBe(true);
    expect(providerSupportsRefresh("LINKEDIN")).toBe(false);
    expect(providerSupportsRefresh("META")).toBe(false);
  });
});
