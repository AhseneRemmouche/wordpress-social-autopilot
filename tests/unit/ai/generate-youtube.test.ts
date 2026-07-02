import { describe, expect, it } from "vitest";

import { youtubePrompt } from "@/lib/ai/prompts/youtube";
import type { PostInput } from "@/lib/ai/prompts/types";
import { PLATFORM_OUTPUT_SCHEMAS } from "@/lib/ai/schemas";
import { getCharLimit, truncateToLimit } from "@/lib/limits";

const POST: PostInput = {
  title: "Build a REST API with Node.js",
  content:
    "A step-by-step tutorial covering routing, middleware, validation, and deployment with Node.js and Express.",
  excerpt: "From zero to deployed API.",
  url: "https://blog.example.com/node-rest-api",
  categories: ["Tutorials"],
  tags: ["nodejs", "api"],
  featuredImageUrl: null,
};

// Representative MOCKED Claude response for the YouTube path.
const MOCK_CLAUDE_RESPONSE = {
  body: "Want to build a production-ready REST API with Node.js? This guide walks you through it end to end.\n\n00:00 Intro\n01:30 Routing\n04:00 Middleware\n07:15 Validation\n10:00 Deployment\n\nFull written tutorial linked below.",
  hashtags: ["#nodejs", "#webdev", "#api", "#javascript"],
};

const schema = PLATFORM_OUTPUT_SCHEMAS.YOUTUBE;

describe("YouTube generation path (mocked Claude) — Principle VII", () => {
  it("builds a user prompt specific to this post (FR-008)", () => {
    const userPrompt = youtubePrompt.buildUserPrompt(POST);
    expect(userPrompt).toContain(POST.title);
    expect(userPrompt).toContain(POST.url);
    expect(userPrompt).toContain("middleware");
  });

  it("validates a well-formed Claude response (flexible hashtag count)", () => {
    expect(schema.safeParse(MOCK_CLAUDE_RESPONSE).success).toBe(true);
    // YouTube is flexible — a few or many hashtags both validate.
    expect(schema.safeParse({ body: "desc", hashtags: [] }).success).toBe(true);
    expect(
      schema.safeParse({ body: "desc", hashtags: Array(20).fill("#tag") }).success,
    ).toBe(true);
  });

  it("yields final content within 5000 chars and containing the post link", () => {
    const parsed = schema.parse(MOCK_CLAUDE_RESPONSE);
    const final = truncateToLimit(parsed.body, POST.url, "YOUTUBE");
    expect(final.length).toBeLessThanOrEqual(getCharLimit("YOUTUBE")); // 5000
    expect(final).toContain(POST.url);
  });

  it("truncates an over-limit body while preserving the link", () => {
    const longBody = "word ".repeat(1500); // ~7500 chars, over 5000
    const final = truncateToLimit(longBody, POST.url, "YOUTUBE");
    expect(final.length).toBeLessThanOrEqual(5000);
    expect(final).toContain(POST.url);
  });

  it("rejects a malformed Claude response (missing/empty body)", () => {
    expect(schema.safeParse({ hashtags: ["#a"] }).success).toBe(false);
    expect(schema.safeParse({ body: "", hashtags: ["#a"] }).success).toBe(false);
  });
});
