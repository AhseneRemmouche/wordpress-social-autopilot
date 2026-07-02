import type { Platform } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { PLATFORM_OUTPUT_SCHEMAS, getOutputSchema } from "@/lib/ai/schemas";

function tags(n: number): string[] {
  return Array.from({ length: n }, (_value, i) => `#tag${i}`);
}

const BOUNDS: Array<{ platform: Platform; min: number; max: number }> = [
  { platform: "LINKEDIN", min: 3, max: 5 },
  { platform: "INSTAGRAM", min: 10, max: 15 },
  { platform: "FACEBOOK", min: 2, max: 3 },
  { platform: "X", min: 1, max: 2 },
  { platform: "TIKTOK", min: 3, max: 5 },
];

describe("ai/schemas — bounded platforms (FR-010 / Principle VII)", () => {
  it.each(BOUNDS)(
    "$platform accepts valid output at the min and max hashtag count",
    ({ platform, min, max }) => {
      const schema = getOutputSchema(platform);
      expect(schema.safeParse({ body: "Post body", hashtags: tags(min) }).success).toBe(
        true,
      );
      expect(schema.safeParse({ body: "Post body", hashtags: tags(max) }).success).toBe(
        true,
      );
    },
  );

  it.each(BOUNDS)(
    "$platform rejects too few or too many hashtags",
    ({ platform, min, max }) => {
      const schema = getOutputSchema(platform);
      expect(
        schema.safeParse({ body: "Post body", hashtags: tags(min - 1) }).success,
      ).toBe(false);
      expect(
        schema.safeParse({ body: "Post body", hashtags: tags(max + 1) }).success,
      ).toBe(false);
    },
  );
});

describe("ai/schemas — YouTube (flexible hashtags)", () => {
  const youtube = getOutputSchema("YOUTUBE");

  it("accepts any hashtag count", () => {
    for (const n of [0, 1, 5, 30]) {
      expect(youtube.safeParse({ body: "Description", hashtags: tags(n) }).success).toBe(
        true,
      );
    }
  });

  it("still requires a non-empty body", () => {
    expect(youtube.safeParse({ body: "", hashtags: [] }).success).toBe(false);
    expect(youtube.safeParse({ hashtags: [] }).success).toBe(false);
  });
});

describe("ai/schemas — malformed-response handling (Principle VII)", () => {
  const schema = getOutputSchema("LINKEDIN");

  it.each([
    ["missing body", { hashtags: ["#a", "#b", "#c"] }],
    ["missing hashtags", { body: "x" }],
    ["body not a string", { body: 123, hashtags: ["#a", "#b", "#c"] }],
    ["hashtags not an array", { body: "x", hashtags: "#a #b #c" }],
    ["hashtags contains non-strings", { body: "x", hashtags: [1, 2, 3] }],
    ["empty body", { body: "", hashtags: ["#a", "#b", "#c"] }],
    ["null", null],
    ["array instead of object", []],
  ])("rejects malformed output: %s", (_name, input) => {
    expect(schema.safeParse(input).success).toBe(false);
  });
});

describe("ai/schemas — completeness", () => {
  it("defines a schema for every platform", () => {
    expect(Object.keys(PLATFORM_OUTPUT_SCHEMAS).sort()).toEqual([
      "FACEBOOK",
      "INSTAGRAM",
      "LINKEDIN",
      "TIKTOK",
      "X",
      "YOUTUBE",
    ]);
  });
});
