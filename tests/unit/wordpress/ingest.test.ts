import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { wordPressPost: { findUnique: vi.fn(), create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { createPostIfNew } from "@/lib/wordpress/ingest";
import type { CompletePost } from "@/lib/wordpress/schema";

const findUnique = prisma.wordPressPost.findUnique as unknown as Mock;
const create = prisma.wordPressPost.create as unknown as Mock;

const POST: CompletePost = {
  wpPostId: "42025",
  title: "Hello World",
  content: "Body content.",
  excerpt: "An excerpt",
  featuredImageUrl: "https://mlscampus.com/img.jpg",
  url: "https://mlscampus.com/hello-world",
  categories: ["news"],
  tags: ["a"],
};

beforeEach(() => {
  findUnique.mockReset().mockResolvedValue(null);
  create.mockReset().mockResolvedValue({ id: "post-1" });
});

describe("createPostIfNew (FR-006)", () => {
  it("creates a new post with generatedAt=null and returns created:true", async () => {
    const res = await createPostIfNew(POST);

    expect(res).toEqual({ postId: "post-1", created: true });
    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0]?.[0]?.data;
    expect(data?.wpPostId).toBe("42025");
    expect(data?.generatedAt).toBeNull();
    expect(data?.sourceComplete).toBe(true);
  });

  it("passes through sourceComplete=false when given", async () => {
    await createPostIfNew(POST, false);
    expect(create.mock.calls[0]?.[0]?.data?.sourceComplete).toBe(false);
  });

  it("returns the existing id with created:false for a known wpPostId", async () => {
    findUnique.mockResolvedValue({ id: "existing-1" });
    const res = await createPostIfNew(POST);

    expect(res).toEqual({ postId: "existing-1", created: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("maps a concurrent P2002 insert to { postId: null, created: false }", async () => {
    create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const res = await createPostIfNew(POST);

    expect(res).toEqual({ postId: null, created: false });
  });

  it("rethrows non-unique DB errors", async () => {
    create.mockRejectedValue(new Error("connection lost"));
    await expect(createPostIfNew(POST)).rejects.toThrow(/connection lost/);
  });
});
