import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

/**
 * AES-256-GCM encryption for secrets at rest (Constitution Principle II, FR-018).
 *
 * Used to encrypt OAuth access/refresh tokens before they are persisted. The
 * stored value packs `iv (12) | authTag (16) | ciphertext` and base64-encodes it.
 * The key is the startup-validated `TOKEN_ENCRYPTION_KEY` (32 bytes, base64).
 *
 * Plaintext and key are NEVER logged.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce — recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

function getKey(): Buffer {
  // env.TOKEN_ENCRYPTION_KEY is validated at startup to decode to exactly 32 bytes.
  return Buffer.from(env.TOKEN_ENCRYPTION_KEY, "base64");
}

/** Encrypt a UTF-8 string. Returns a base64 token (iv | authTag | ciphertext). */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Decrypt a token produced by {@link encrypt}. Throws if the payload is
 * malformed or fails authentication (tampering). Error messages never contain
 * secret material.
 */
export function decrypt(token: string): string {
  const data = Buffer.from(token, "base64");
  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid ciphertext: payload too short");
  }
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(), // throws on authentication failure (tampered data)
  ]);
  return plaintext.toString("utf8");
}
