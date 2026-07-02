import { createHash, randomBytes } from "node:crypto";

/**
 * PKCE (RFC 7636) helpers for the OAuth 2.0 Authorization Code flow used by X and
 * TikTok (FR-017, plan §6). The `code_verifier` is stored server-side against the
 * OAuth `state`; the S256 `code_challenge` goes on the authorize URL.
 */

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

/**
 * A high-entropy `code_verifier`: base64url(32 random bytes) → 43 chars, within
 * the RFC's 43–128 range and using only the allowed unreserved characters.
 */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/** Derive the S256 `code_challenge`: base64url(SHA-256(code_verifier)). */
export function deriveCodeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

/** Generate a fresh verifier + its S256 challenge. */
export function generatePkcePair(): PkcePair {
  const codeVerifier = generateCodeVerifier();
  return {
    codeVerifier,
    codeChallenge: deriveCodeChallenge(codeVerifier),
    codeChallengeMethod: "S256",
  };
}
