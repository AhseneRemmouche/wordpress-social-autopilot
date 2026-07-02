import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Verify a WordPress webhook signature (Constitution Principle II, FR-002).
 *
 * Computes HMAC-SHA256 over the **raw request body** with `WEBHOOK_SECRET` and
 * compares it to the `X-WSA-Signature: sha256=<hex>` header using a constant-time
 * comparison. Returns `false` for any missing/malformed/mismatched signature —
 * the caller MUST reject before any further processing.
 */

const SIGNATURE_PREFIX = "sha256=";

export function verifySignature(
  rawBody: string | Buffer,
  header: string | null | undefined,
): boolean {
  if (!header) return false;

  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith(SIGNATURE_PREFIX)) return false;

  const providedHex = trimmed.slice(SIGNATURE_PREFIX.length).trim().toLowerCase();
  if (providedHex.length === 0) return false;

  const expectedHex = createHmac("sha256", env.WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const providedBuf = Buffer.from(providedHex, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");

  // Unequal lengths (incl. invalid/odd hex) can't be a match; also avoids
  // timingSafeEqual throwing on length mismatch.
  if (providedBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(providedBuf, expectedBuf);
}
