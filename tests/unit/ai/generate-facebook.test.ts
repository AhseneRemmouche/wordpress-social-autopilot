import { describe, expect, it } from "vitest";

import { facebookPrompt } from "@/lib/ai/prompts/facebook";
import type { PostInput } from "@/lib/ai/prompts/types";
import { PLATFORM_OUTPUT_SCHEMAS } from "@/lib/ai/schemas";
import { getCharLimit, truncateToLimit } from "@/lib/limits";

const POST: PostInput = {
  title: "Weeknight Pasta in 20 Minutes",
  content:
    "A quick garlic-and-olive-oil pasta recipe with cherry tomatoes for busy weeknights.",
  excerpt: "Fast, cheap, delicious.",
  url: "https://blog.example.com/weeknight-pasta",
  categories: ["Recipes"],
  tags: ["pasta", "quick"],
  featuredImageUrl: "https://blog.example.com/pasta.jpg",
};

// Representative MOCKED Claude response for the Facebook path (short, 2 hashtags).
const MOCK_CLAUDE_RESPONSE = {
  body: "Busy night? This 20-minute garlic & olive oil pasta is about to save dinner 🍝 Cherry tomatoes optional but highly recommended. Recipe here 👇",
  hashtags: ["#weeknightdinner", "#easyrecipes"],
};

const schema = PLATFORM_OUTPUT_SCHEMAS.FACEBOOK;

describe("Facebook generation path (mocked Claude) — Principle VII", () => {
  it("builds a user prompt specific to this post (FR-008)", () => {
    const userPrompt = facebookPrompt.buildUserPrompt(POST);
    expect(userPrompt).toContain(POST.title);
    expect(userPrompt).toContain(POST.url);
    expect(userPrompt).toContain("garlic");
  });

  it("validates a well-formed Claude response with 2–3 hashtags", () => {
    const result = schema.safeParse(MOCK_CLAUDE_RESPONSE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hashtags.length).toBeGreaterThanOrEqual(2);
      expect(result.data.hashtags.length).toBeLessThanOrEqual(3);
    }
  });

  it("yields final content within the 500-char target, with the clickable link", () => {
    const parsed = schema.parse(MOCK_CLAUDE_RESPONSE);
    const final = truncateToLimit(parsed.body, POST.url, "FACEBOOK");
    expect(final.length).toBeLessThanOrEqual(getCharLimit("FACEBOOK")); // 500
    expect(final).toContain(POST.url);
  });

  it("truncates an over-limit body while preserving the link", () => {
    const longBody = "word ".repeat(300); // ~1500 chars, over 500
    const final = truncateToLimit(longBody, POST.url, "FACEBOOK");
    expect(final.length).toBeLessThanOrEqual(500);
    expect(final).toContain(POST.url);
  });

  it("rejects a malformed Claude response (too many hashtags)", () => {
    const bad = { body: "x", hashtags: ["#1", "#2", "#3", "#4"] }; // 4 > 3
    expect(schema.safeParse(bad).success).toBe(false);
  });
});
