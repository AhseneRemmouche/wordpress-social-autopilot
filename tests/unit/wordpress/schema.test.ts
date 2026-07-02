import { describe, expect, it } from "vitest";

import {
  completePostSchema,
  getMissingGenerationFields,
  isCompleteForGeneration,
  webhookPayloadSchema,
} from "@/lib/wordpress/schema";

const COMPLETE = {
  wpPostId: "1234",
  event: "post_published",
  title: "Hello World",
  content: "Full body content here.",
  excerpt: "Short excerpt",
  featuredImageUrl: "https://blog.example.com/img.jpg",
  url: "https://blog.example.com/hello-world",
  categories: ["news", "updates"],
  tags: ["a", "b"],
};

describe("webhookPayloadSchema (FR-004 / Principle VII)", () => {
  it("parses a complete payload", () => {
    const result = webhookPayloadSchema.safeParse(COMPLETE);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wpPostId).toBe("1234");
      expect(result.data.categories).toEqual(["news", "updates"]);
    }
  });

  it("parses a minimal payload (only wpPostId) and defaults the arrays", () => {
    const result = webhookPayloadSchema.safeParse({ wpPostId: "9" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.categories).toEqual([]);
      expect(result.data.tags).toEqual([]);
      expect(result.data.title).toBeUndefined();
    }
  });

  it("strips unknown keys", () => {
    const result = webhookPayloadSchema.safeParse({
      wpPostId: "1",
      author: "Jane",
      randomField: 42,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("author");
    }
  });

  it("rejects a payload missing wpPostId", () => {
    expect(webhookPayloadSchema.safeParse({ title: "x" }).success).toBe(false);
    expect(webhookPayloadSchema.safeParse({ wpPostId: "" }).success).toBe(false);
  });

  it("rejects wrong field types", () => {
    expect(
      webhookPayloadSchema.safeParse({ ...COMPLETE, title: 123 }).success,
    ).toBe(false);
    expect(
      webhookPayloadSchema.safeParse({ ...COMPLETE, categories: "news" }).success,
    ).toBe(false);
    expect(
      webhookPayloadSchema.safeParse({ ...COMPLETE, tags: [1, 2] }).success,
    ).toBe(false);
  });
});

describe("getMissingGenerationFields / isCompleteForGeneration (FR-005)", () => {
  it("returns no missing fields for a complete payload", () => {
    expect(getMissingGenerationFields(COMPLETE)).toEqual([]);
    expect(isCompleteForGeneration(COMPLETE)).toBe(true);
  });

  it("flags a missing field", () => {
    const { content: _omit, ...partial } = COMPLETE;
    expect(getMissingGenerationFields(partial)).toEqual(["content"]);
    expect(isCompleteForGeneration(partial)).toBe(false);
  });

  it("treats empty / whitespace-only values as missing", () => {
    expect(
      getMissingGenerationFields({ ...COMPLETE, title: "   ", url: "" }),
    ).toEqual(["title", "url"]);
  });

  it("flags all required fields when none are present", () => {
    expect(getMissingGenerationFields({})).toEqual(["title", "content", "url"]);
  });
});

describe("completePostSchema (generation-ready gate)", () => {
  it("parses a complete, valid post", () => {
    expect(completePostSchema.safeParse(COMPLETE).success).toBe(true);
  });

  it("allows a null featured image and defaults excerpt/arrays", () => {
    const result = completePostSchema.safeParse({
      wpPostId: "1",
      title: "T",
      content: "C",
      url: "https://blog.example.com/p",
      featuredImageUrl: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.excerpt).toBe("");
      expect(result.data.featuredImageUrl).toBeNull();
      expect(result.data.categories).toEqual([]);
    }
  });

  it("rejects empty title/content and an invalid url", () => {
    expect(
      completePostSchema.safeParse({ ...COMPLETE, title: "" }).success,
    ).toBe(false);
    expect(
      completePostSchema.safeParse({ ...COMPLETE, content: "" }).success,
    ).toBe(false);
    expect(
      completePostSchema.safeParse({ ...COMPLETE, url: "not-a-url" }).success,
    ).toBe(false);
  });
});
