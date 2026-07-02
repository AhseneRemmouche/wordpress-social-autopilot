import { describe, expect, it } from "vitest";

import {
  PLATFORM_CHAR_LIMITS,
  getCharLimit,
  truncateToLimit,
} from "@/lib/limits";

const LINK = "https://blog.example.com/my-post";
// Distinct, fixed words so a mid-word cut would produce a token NOT in this set.
const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf"];

function makeLongBody(wordCount: number): string {
  return Array.from(
    { length: wordCount },
    (_unused, i) => WORDS[i % WORDS.length],
  ).join(" ");
}

/** Body portion of a result (everything before the appended link). */
function bodyOf(result: string): string {
  return result.slice(0, result.lastIndexOf(LINK)).trim();
}

describe("limits — PLATFORM_CHAR_LIMITS (FR-010)", () => {
  it("defines the documented limit for every platform", () => {
    expect(PLATFORM_CHAR_LIMITS).toEqual({
      LINKEDIN: 3000,
      INSTAGRAM: 2200,
      FACEBOOK: 500,
      YOUTUBE: 5000,
      X: 280,
      TIKTOK: 2200,
    });
    expect(getCharLimit("X")).toBe(280);
  });
});

describe("limits — truncateToLimit (FR-011)", () => {
  it("leaves under-limit body intact and appends the link", () => {
    const text = "A short and sweet post about cats";
    const result = truncateToLimit(text, LINK, "LINKEDIN");

    expect(result.length).toBeLessThanOrEqual(getCharLimit("LINKEDIN"));
    expect(result).toContain(text); // body not truncated
    expect(result).toContain(LINK); // link present
  });

  it("hard-truncates over-limit body at a word boundary, link preserved + within limit", () => {
    const limit = getCharLimit("X"); // 280
    const longBody = makeLongBody(200); // ~1.3k chars, far over 280
    const result = truncateToLimit(longBody, LINK, "X");

    expect(result.length).toBeLessThanOrEqual(limit);
    expect(result.endsWith(LINK)).toBe(true); // link at the end, never cut
    expect(result).toContain(LINK);

    // Body portion must consist only of WHOLE words (no mid-word cut).
    const tokens = bodyOf(result).split(/\s+/).filter(Boolean);
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(WORDS).toContain(token);
    }
  });

  it("never truncates the link even when the body is huge", () => {
    const longBody = makeLongBody(500);
    const result = truncateToLimit(longBody, LINK, "X");
    expect(result).toContain(LINK); // the full, intact link is present
    expect(result.length).toBeLessThanOrEqual(getCharLimit("X"));
  });

  it("preserves a long link in full, truncating the body to fit", () => {
    const longLink = `https://blog.example.com/${"x".repeat(220)}`; // ~245 chars
    const result = truncateToLimit(makeLongBody(100), longLink, "X");
    expect(result).toContain(longLink); // link intact
    expect(result.length).toBeLessThanOrEqual(getCharLimit("X"));
  });

  it("does not duplicate a link already present in the text", () => {
    const text = `Some body text that already ends with the link ${LINK}`;
    const result = truncateToLimit(text, LINK, "FACEBOOK");
    const occurrences = result.split(LINK).length - 1;
    expect(occurrences).toBe(1);
  });

  it("respects each platform's limit", () => {
    const body = makeLongBody(2000);
    for (const platform of [
      "LINKEDIN",
      "INSTAGRAM",
      "FACEBOOK",
      "YOUTUBE",
      "X",
      "TIKTOK",
    ] as const) {
      const result = truncateToLimit(body, LINK, platform);
      expect(result.length).toBeLessThanOrEqual(getCharLimit(platform));
      expect(result).toContain(LINK);
    }
  });
});
