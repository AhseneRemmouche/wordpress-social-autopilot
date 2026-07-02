import { describe, expect, it } from "vitest";

import { instagramPrompt } from "@/lib/ai/prompts/instagram";
import type { PostInput } from "@/lib/ai/prompts/types";
import { PLATFORM_OUTPUT_SCHEMAS } from "@/lib/ai/schemas";
import { getCharLimit, truncateToLimit } from "@/lib/limits";

const POST: PostInput = {
  title: "5 Houseplants That Thrive in Low Light",
  content:
    "A friendly guide to pothos, snake plants, and ZZ plants for dim apartments.",
  excerpt: "Greenery for dark corners.",
  url: "https://blog.example.com/low-light-plants",
  categories: ["Home"],
  tags: ["plants", "indoor"],
  featuredImageUrl: "https://blog.example.com/plants.jpg",
};

// Representative MOCKED Claude response for the Instagram path (12 hashtags).
const MOCK_CLAUDE_RESPONSE = {
  body: "No sunny windows? No problem. 🌿\n\nThese 5 houseplants actually love the shade — pothos, snake plants, ZZ plants and more. Full guide at the link in our latest post!",
  hashtags: [
    "#houseplants",
    "#lowlightplants",
    "#indoorplants",
    "#plantsofinstagram",
    "#urbanjungle",
    "#plantcare",
    "#pothos",
    "#snakeplant",
    "#zzplant",
    "#plantparent",
    "#greenhome",
    "#plantlover",
  ],
};

const schema = PLATFORM_OUTPUT_SCHEMAS.INSTAGRAM;

describe("Instagram generation path (mocked Claude) — Principle VII", () => {
  it("builds a user prompt specific to this post (FR-008)", () => {
    const userPrompt = instagramPrompt.buildUserPrompt(POST);
    expect(userPrompt).toContain(POST.title);
    expect(userPrompt).toContain(POST.url);
    expect(userPrompt).toContain("pothos");
  });

  it("validates a well-formed Claude response with 10–15 hashtags", () => {
    const result = schema.safeParse(MOCK_CLAUDE_RESPONSE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hashtags.length).toBeGreaterThanOrEqual(10);
      expect(result.data.hashtags.length).toBeLessThanOrEqual(15);
    }
  });

  it("yields final content within 2200 chars and containing the post link", () => {
    const parsed = schema.parse(MOCK_CLAUDE_RESPONSE);
    const final = truncateToLimit(parsed.body, POST.url, "INSTAGRAM");
    expect(final.length).toBeLessThanOrEqual(getCharLimit("INSTAGRAM")); // 2200
    expect(final).toContain(POST.url);
  });

  it("truncates an over-limit body while preserving the link", () => {
    const longBody = "word ".repeat(800); // ~4000 chars, over 2200
    const final = truncateToLimit(longBody, POST.url, "INSTAGRAM");
    expect(final.length).toBeLessThanOrEqual(2200);
    expect(final).toContain(POST.url);
  });

  it("rejects a malformed Claude response (too few hashtags)", () => {
    const bad = { body: "x", hashtags: ["#1", "#2", "#3"] }; // 3 < 10
    expect(schema.safeParse(bad).success).toBe(false);
  });
});
