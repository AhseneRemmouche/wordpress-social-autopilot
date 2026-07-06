import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB and the owner guard (auth is exercised in its own tests).
vi.mock("@/lib/prisma", () => ({
  prisma: { wordPressPost: { deleteMany: vi.fn() } },
}));
vi.mock("@/lib/oauth/session", () => ({ requireOwner: vi.fn() }));

import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";
import { DELETE } from "@/app/api/posts/[postId]/route";

const deleteMany = prisma.wordPressPost.deleteMany as unknown as Mock;
const requireOwnerMock = requireOwner as unknown as Mock;

const req = () =>
  new Request("http://localhost:3000/api/posts/abc", { method: "DELETE" });
const ctx = (postId = "abc") => ({ params: Promise.resolve({ postId }) });

beforeEach(() => {
  requireOwnerMock.mockReset().mockResolvedValue(true);
  deleteMany.mockReset().mockResolvedValue({ count: 1 });
});

describe("DELETE /api/posts/[postId]", () => {
  it("deletes the post (cascade removes its content) and returns 200", async () => {
    const res = await DELETE(req(), ctx("abc"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: "abc" });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "abc" } });
  });

  it("404 when the post does not exist (count 0)", async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    const res = await DELETE(req(), ctx("missing"));

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "post not found" });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "missing" } });
  });

  it("401 when not the owner — nothing deleted", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await DELETE(req(), ctx("abc"));

    expect(res.status).toBe(401);
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
