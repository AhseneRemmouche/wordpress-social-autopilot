import { describe, expect, it } from "vitest";

import { tiktokPrompt } from "@/lib/ai/prompts/tiktok";
import type { PostInput } from "@/lib/ai/prompts/types";
import { PLATFORM_OUTPUT_SCHEMAS } from "@/lib/ai/schemas";
import { getCharLimit, truncateToLimit } from "@/lib/limits";

const POST: PostInput = {
  title: "3 Budgeting Mistakes Keeping You Broke",
  content:
    "Common money traps — lifestyle creep, no emergency fund, and ignoring subscriptions — and how to fix them.",
  excerpt: "Stop leaking money.",
  url: "https://blog.example.com/budgeting-mistakes",
  categories: ["Finance"],
  tags: ["money", "budgeting"],
  featuredImageUrl: "https://blog.example.com/budget.jpg",
};

// Representative MOCKED Claude response for the TikTok path (4 hashtags).
const MOCK_CLAUDE_RESPONSE = {
  body: "You're not broke — you're leaking money in 3 sneaky ways 👀\n\nLifestyle creep, no emergency fund, and forgotten subscriptions are quietly draining you. Full breakdown + fixes — link in bio!",
  hashtags: ["#moneytok", "#budgeting", "#personalfinance", "#savingtips"],
};

const schema = PLATFORM_OUTPUT_SCHEMAS.TIKTOK;

describe("TikTok generation path (mocked Claude) — Principle VII", () => {
  it("builds a user prompt specific to this post (FR-008)", () => {
    const userPrompt = tiktokPrompt.buildUserPrompt(POST);
    expect(userPrompt).toContain(POST.title);
    expect(userPrompt).toContain(POST.url);
    expect(userPrompt).toContain("lifestyle creep");
  });

  it("validates a well-formed Claude response with 3–5 hashtags", () => {
    const result = schema.safeParse(MOCK_CLAUDE_RESPONSE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hashtags.length).toBeGreaterThanOrEqual(3);
      expect(result.data.hashtags.length).toBeLessThanOrEqual(5);
    }
  });

  it("yields final content within 2200 chars and containing the post link (bio note)", () => {
    const parsed = schema.parse(MOCK_CLAUDE_RESPONSE);
    const final = truncateToLimit(parsed.body, POST.url, "TIKTOK");
    expect(final.length).toBeLessThanOrEqual(getCharLimit("TIKTOK")); // 2200
    expect(final).toContain(POST.url);
  });

  it("truncates an over-limit body while preserving the link", () => {
    const longBody = "word ".repeat(800); // ~4000 chars, over 2200
    const final = truncateToLimit(longBody, POST.url, "TIKTOK");
    expect(final.length).toBeLessThanOrEqual(2200);
    expect(final).toContain(POST.url);
  });

  it("rejects a malformed Claude response (too few hashtags)", () => {
    const bad = { body: "x", hashtags: ["#1", "#2"] }; // 2 < 3
    expect(schema.safeParse(bad).success).toBe(false);
  });
});
