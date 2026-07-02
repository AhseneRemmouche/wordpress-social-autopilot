import { describe, expect, it } from "vitest";

import { xPrompt } from "@/lib/ai/prompts/x";
import type { PostInput } from "@/lib/ai/prompts/types";
import { PLATFORM_OUTPUT_SCHEMAS } from "@/lib/ai/schemas";
import { getCharLimit, truncateToLimit } from "@/lib/limits";

const POST: PostInput = {
  title: "Cut Postgres Write Latency in One Config Change",
  content:
    "How adjusting synchronous_commit and connection pooling slashed our write latency.",
  excerpt: "One change, big win.",
  url: "https://blog.example.com/pg-writes",
  categories: ["Engineering"],
  tags: ["postgres"],
  featuredImageUrl: null,
};

const LINK = POST.url;

// Representative MOCKED Claude response for the X path (short body, 2 hashtags).
const MOCK_CLAUDE_RESPONSE = {
  body: "One Postgres config change cut our write latency hard. Here's exactly what we changed and why it worked.",
  hashtags: ["#PostgreSQL", "#DevOps"],
};

const schema = PLATFORM_OUTPUT_SCHEMAS.X;

/** Compose the full tweet text (body + hashtags) the way the publisher will. */
function compose(body: string, hashtags: string[]): string {
  return `${body} ${hashtags.join(" ")}`.trim();
}

describe("X generation path (mocked Claude) — Principle VII", () => {
  it("builds a user prompt specific to this post (FR-008)", () => {
    const userPrompt = xPrompt.buildUserPrompt(POST);
    expect(userPrompt).toContain(POST.title);
    expect(userPrompt).toContain(POST.url);
    expect(userPrompt).toContain("synchronous_commit");
  });

  it("validates a well-formed Claude response with 1–2 hashtags", () => {
    const result = schema.safeParse(MOCK_CLAUDE_RESPONSE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hashtags.length).toBeGreaterThanOrEqual(1);
      expect(result.data.hashtags.length).toBeLessThanOrEqual(2);
    }
  });

  it("produces final content strictly within 280 chars INCLUDING the link", () => {
    const parsed = schema.parse(MOCK_CLAUDE_RESPONSE);
    const text = compose(parsed.body, parsed.hashtags);
    const final = truncateToLimit(text, LINK, "X");
    expect(final.length).toBeLessThanOrEqual(getCharLimit("X")); // 280
    expect(final).toContain(LINK);
  });

  it("truncates an over-limit composition to ≤280 while preserving the link", () => {
    const longBody = "word ".repeat(100); // ~500 chars, well over 280
    const final = truncateToLimit(
      compose(longBody, ["#a", "#b"]),
      LINK,
      "X",
    );
    expect(final.length).toBeLessThanOrEqual(280);
    expect(final).toContain(LINK);
  });

  it("rejects malformed responses (zero or too many hashtags)", () => {
    expect(schema.safeParse({ body: "x", hashtags: [] }).success).toBe(false); // 0 < 1
    expect(
      schema.safeParse({ body: "x", hashtags: ["#1", "#2", "#3"] }).success,
    ).toBe(false); // 3 > 2
  });
});
