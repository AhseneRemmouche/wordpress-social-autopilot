import { describe, expect, it } from "vitest";

import { OWNER_GITHUB_LOGINS, isOwnerLogin, parseOwnerLogins } from "@/lib/env";

describe("parseOwnerLogins", () => {
  it("splits on commas, trims, and drops empties", () => {
    expect(parseOwnerLogins("owner-a, owner-b ,  ,owner-c")).toEqual([
      "owner-a",
      "owner-b",
      "owner-c",
    ]);
  });

  it("a single value yields a one-element list", () => {
    expect(parseOwnerLogins("solo")).toEqual(["solo"]);
  });
});

describe("isOwnerLogin", () => {
  it("matches every configured owner login and rejects others", () => {
    expect(OWNER_GITHUB_LOGINS.length).toBeGreaterThan(0);
    for (const login of OWNER_GITHUB_LOGINS) {
      expect(isOwnerLogin(login)).toBe(true);
    }
    expect(isOwnerLogin("definitely-not-an-owner-xyz")).toBe(false);
  });
});
