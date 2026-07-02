import { describe, expect, it } from "vitest";

import { decrypt, encrypt } from "@/lib/crypto";

/** Flip one byte (XOR 0xff) at a given index of a base64 token. */
function flipByte(token: string, index: number): string {
  const buf = Buffer.from(token, "base64");
  buf.writeUInt8(buf.readUInt8(index) ^ 0xff, index);
  return buf.toString("base64");
}

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

describe("crypto AES-256-GCM (Principle II / VII)", () => {
  const inputs: Array<[name: string, value: string]> = [
    ["empty string", ""],
    ["single char", "x"],
    ["short phrase", "hello world"],
    ["realistic OAuth token", "ya29.A0ARrdaM-EXAMPLE_token-1234567890abcdef"],
    ["unicode", "héllo 🌍 こんにちは — ©™"],
    ["long string", "a".repeat(2000)],
  ];

  it.each(inputs)("round-trips %s: decrypt(encrypt(x)) === x", (_name, value) => {
    expect(decrypt(encrypt(value))).toBe(value);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    const a = encrypt("same-plaintext");
    const b = encrypt("same-plaintext");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe("same-plaintext");
    expect(decrypt(b)).toBe("same-plaintext");
  });

  it("throws when the ciphertext is tampered", () => {
    const token = encrypt("hello world");
    // First ciphertext byte is right after iv + authTag.
    const tampered = flipByte(token, IV_LENGTH + AUTH_TAG_LENGTH);
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws when the auth tag is tampered", () => {
    const token = encrypt("hello world");
    const tampered = flipByte(token, IV_LENGTH); // first authTag byte
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws when the IV is tampered", () => {
    const token = encrypt("hello world");
    const tampered = flipByte(token, 0); // first iv byte
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws on a payload that is too short", () => {
    expect(() => decrypt(Buffer.alloc(10).toString("base64"))).toThrow(
      /too short/,
    );
  });
});
