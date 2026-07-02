import { describe, expect, it } from "vitest";

import { linkedinPrompt } from "@/lib/ai/prompts/linkedin";
import type { PostInput } from "@/lib/ai/prompts/types";
import { PLATFORM_OUTPUT_SCHEMAS } from "@/lib/ai/schemas";
import { getCharLimit, truncateToLimit } from "@/lib/limits";

const POST: PostInput = {
  title: "Scaling Postgres for High-Write Workloads",
  content:
    "A deep dive into partitioning, connection pooling, and write amplification when scaling PostgreSQL.",
  excerpt: "How we scaled writes.",
  url: "https://blog.example.com/scaling-postgres",
  categories: ["Engineering"],
  tags: ["postgres", "scaling"],
  featuredImageUrl: null,
};

// A representative MOCKED Claude response for the LinkedIn path.
const MOCK_CLAUDE_RESPONSE = {
  body: "Most teams hit a write wall with Postgres far earlier than they expect.\n\nOur latest piece breaks down partitioning, pooling, and write amplification — and the trade-offs that actually moved the needle.\n\nIf you're scaling a write-heavy system, give it a read.",
  hashtags: ["#PostgreSQL", "#Engineering", "#Scaling", "#Databases"],
};

const schema = PLATFORM_OUTPUT_SCHEMAS.LINKEDIN;

describe("LinkedIn generation path (mocked Claude) — Principle VII", () => {
  it("builds a user prompt specific to this post (FR-008)", () => {
    const userPrompt = linkedinPrompt.buildUserPrompt(POST);
    expect(userPrompt).toContain(POST.title);
    expect(userPrompt).toContain(POST.url);
    expect(userPrompt).toContain("partitioning"); // real content, not a generic summary
  });

  it("validates a well-formed Claude response against the LinkedIn schema", () => {
    const result = schema.safeParse(MOCK_CLAUDE_RESPONSE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hashtags.length).toBeGreaterThanOrEqual(3);
      expect(result.data.hashtags.length).toBeLessThanOrEqual(5);
    }
  });

  it("yields final content within 3000 chars and containing the post link (FR-009/FR-011)", () => {
    const parsed = schema.parse(MOCK_CLAUDE_RESPONSE);
    const final = truncateToLimit(parsed.body, POST.url, "LINKEDIN");
    expect(final.length).toBeLessThanOrEqual(getCharLimit("LINKEDIN")); // 3000
    expect(final).toContain(POST.url);
  });

  it("truncates an over-limit body while preserving the link", () => {
    const longBody = "word ".repeat(1000); // ~5000 chars, well over 3000
    const final = truncateToLimit(longBody, POST.url, "LINKEDIN");
    expect(final.length).toBeLessThanOrEqual(3000);
    expect(final).toContain(POST.url);
  });

  it("rejects a malformed Claude response (too many hashtags)", () => {
    const bad = {
      body: "x",
      hashtags: ["#1", "#2", "#3", "#4", "#5", "#6"],
    };
    expect(schema.safeParse(bad).success).toBe(false);
  });
});
