import { createHmac } from "node:crypto";

import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    wordPressPost: { findUnique: vi.fn(), create: vi.fn() },
    generatedContent: { create: vi.fn() },
  },
}));
vi.mock("@/lib/wordpress/novamira", () => ({
  fetchFullPost: vi.fn(),
  NovaMiraError: class NovaMiraError extends Error {},
}));

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/webhooks/wordpress/route";

const createPost = prisma.wordPressPost.create as unknown as Mock;
const findPost = prisma.wordPressPost.findUnique as unknown as Mock;
const createContent = prisma.generatedContent.create as unknown as Mock;

const PAYLOAD = {
  wpPostId: "7777",
  event: "post_published",
  title: "Secure Me",
  content: "The full body content of a legitimately signed post.",
  excerpt: "Excerpt",
  featuredImageUrl: "https://blog.example.com/img.jpg",
  url: "https://blog.example.com/secure-me",
  categories: ["news"],
  tags: ["a"],
};
const BODY = JSON.stringify(PAYLOAD);

function sign(body: string, secret: string = env.WEBHOOK_SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

/** Flip the last hex nibble to a guaranteed-different value (same length, valid hex). */
function corruptDigest(signature: string): string {
  const last = signature.slice(-1);
  return signature.slice(0, -1) + (last === "0" ? "1" : "0");
}

function post(body: string, signature?: string): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature !== undefined) headers["x-wsa-signature"] = signature;
  return POST(
    new Request("http://localhost/api/webhooks/wordpress", { method: "POST", body, headers }),
  );
}

beforeEach(() => {
  findPost.mockReset().mockResolvedValue(null);
  createPost.mockReset().mockResolvedValue({ id: "post-1" });
  createContent.mockReset();
});

describe("webhook signature security (SC-006, Principle II/VII)", () => {
  it("control: a correctly signed request IS accepted (test is not trivially rejecting)", async () => {
    const res = await post(BODY, sign(BODY));
    expect(res.status).toBe(202);
    expect(createPost).toHaveBeenCalledTimes(1);
  });

  it("rejects every malformed/missing/wrong signature with 401 and no persistence", async () => {
    const badSignatures: Array<string | undefined> = [
      undefined, // missing header
      "", // empty
      "deadbeef", // no sha256= prefix
      "sha256=", // empty digest
      "sha256=nothex!!", // invalid hex
      "sha256=deadbeef", // wrong (short) digest
      sign(BODY, "the-wrong-secret"), // valid shape, wrong secret
      corruptDigest(sign(BODY)), // right length, one nibble off
      sign(JSON.stringify({ ...PAYLOAD, title: "Hijacked" })), // signature for a different body
    ];

    for (const signature of badSignatures) {
      const res = await post(BODY, signature);
      expect(res.status).toBe(401);
    }

    // Not one invalid request created a post (⇒ no generation, no publish downstream).
    expect(createPost).not.toHaveBeenCalled();
    expect(createContent).not.toHaveBeenCalled();
  });

  it("rejects tampered bodies 100% of the time (fuzz: original signature, mutated body)", async () => {
    const signature = sign(BODY); // signature bound to the ORIGINAL body

    for (let i = 0; i < 100; i++) {
      // Deterministic-ish mutation without Math.random dependence on outcome:
      const mutated = JSON.stringify({ ...PAYLOAD, title: `Tampered ${i}`, nonce: i });
      const res = await post(mutated, signature);
      expect(res.status).toBe(401);
    }

    expect(createPost).not.toHaveBeenCalled();
    expect(createContent).not.toHaveBeenCalled();
  });

  it("verifies the signature BEFORE parsing/backfill (no DB lookup on rejection)", async () => {
    await post(BODY, "sha256=deadbeef");
    expect(findPost).not.toHaveBeenCalled(); // rejected before any processing
  });
});
