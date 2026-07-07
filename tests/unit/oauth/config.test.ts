import type { Platform } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  accountAutoRenews,
  providerIsNonExpiring,
  providerSupportsRefresh,
} from "@/lib/oauth/config";

describe("providerSupportsRefresh", () => {
  it("is true for the refresh-grant providers (X / TIKTOK / GOOGLE / LINKEDIN)", () => {
    expect(providerSupportsRefresh("X")).toBe(true);
    expect(providerSupportsRefresh("TIKTOK")).toBe(true);
    expect(providerSupportsRefresh("GOOGLE")).toBe(true);
    expect(providerSupportsRefresh("LINKEDIN")).toBe(true);
    // Meta has no refresh_token grant (its Page token is non-expiring instead).
    expect(providerSupportsRefresh("META")).toBe(false);
  });
});

describe("providerIsNonExpiring", () => {
  it("is true only for META (Page token derived from a long-lived user token)", () => {
    expect(providerIsNonExpiring("META")).toBe(true);
    for (const p of ["X", "TIKTOK", "GOOGLE", "LINKEDIN"] as const) {
      expect(providerIsNonExpiring(p)).toBe(false);
    }
  });
});

describe("accountAutoRenews (connections UI + reminder source of truth)", () => {
  it("Facebook/Instagram always auto-renew (non-expiring Page token), even with no refresh token", () => {
    for (const platform of ["FACEBOOK", "INSTAGRAM"] as Platform[]) {
      expect(accountAutoRenews(platform, false)).toBe(true);
      expect(accountAutoRenews(platform, true)).toBe(true);
    }
  });

  it("LinkedIn auto-renews ONLY when a refresh token is actually stored", () => {
    expect(accountAutoRenews("LINKEDIN", true)).toBe(true); // provisioned → refresh token present
    expect(accountAutoRenews("LINKEDIN", false)).toBe(false); // not provisioned → honest expiry
  });

  it("X / TikTok / YouTube auto-renew when they hold their refresh token", () => {
    for (const platform of ["X", "TIKTOK", "YOUTUBE"] as Platform[]) {
      expect(accountAutoRenews(platform, true)).toBe(true);
      expect(accountAutoRenews(platform, false)).toBe(false);
    }
  });
});
