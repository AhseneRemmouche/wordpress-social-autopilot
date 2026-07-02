import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { env } from "@/lib/env";
import { verifySignature } from "@/lib/webhook/verify";

/** Build a valid `sha256=<hex>` header for `body` using a given secret. */
function sign(body: string, secret: string = env.WEBHOOK_SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

const BODY = JSON.stringify({ wpPostId: "1", title: "Hello" });

describe("verifySignature (Principle II / FR-002 / SC-006)", () => {
  it("passes for a valid signature", () => {
    expect(verifySignature(BODY, sign(BODY))).toBe(true);
  });

  it("passes for a Buffer body with a valid signature", () => {
    const buf = Buffer.from(BODY, "utf8");
    expect(verifySignature(buf, sign(BODY))).toBe(true);
  });

  it("is case-insensitive on the scheme and hex", () => {
    const header = sign(BODY).replace("sha256=", "SHA256=").toUpperCase();
    expect(verifySignature(BODY, header)).toBe(true);
  });

  it("fails when signed with the wrong secret", () => {
    expect(verifySignature(BODY, sign(BODY, "the-wrong-secret"))).toBe(false);
  });

  it("fails when the body is tampered", () => {
    const header = sign(BODY);
    const tamperedBody = BODY.replace("Hello", "Goodbye");
    expect(verifySignature(tamperedBody, header)).toBe(false);
  });

  it("fails for a missing header", () => {
    expect(verifySignature(BODY, null)).toBe(false);
    expect(verifySignature(BODY, undefined)).toBe(false);
    expect(verifySignature(BODY, "")).toBe(false);
  });

  it.each([
    ["no prefix (bare hex)", createHmac("sha256", env.WEBHOOK_SECRET).update(BODY).digest("hex")],
    ["wrong scheme", "md5=abcdef"],
    ["empty digest", "sha256="],
    ["non-hex garbage", "sha256=not-a-valid-hex-digest"],
    ["truncated digest", "sha256=abcd"],
  ])("fails for a malformed header: %s", (_name, header) => {
    expect(verifySignature(BODY, header)).toBe(false);
  });
});
