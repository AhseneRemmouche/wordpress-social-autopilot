import { describe, expect, it } from "vitest";

import {
  deriveCodeChallenge,
  generateCodeVerifier,
  generatePkcePair,
} from "@/lib/oauth/pkce";

// RFC 7636 Appendix B known test vector.
const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

const BASE64URL = /^[A-Za-z0-9_-]+$/; // URL-safe, unpadded

describe("pkce (FR-017, Principle VII)", () => {
  it("derives the S256 challenge matching the RFC 7636 test vector", () => {
    expect(deriveCodeChallenge(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
  });

  it("derivation is deterministic", () => {
    expect(deriveCodeChallenge(RFC_VERIFIER)).toBe(deriveCodeChallenge(RFC_VERIFIER));
  });

  it("generates a spec-compliant code_verifier", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(BASE64URL);
    // base64url(32 bytes) → 43 chars, within the RFC's 43–128 range.
    expect(verifier.length).toBe(43);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it("generates a fresh verifier each call", () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
  });

  it("generatePkcePair returns an S256 pair whose challenge derives from the verifier", () => {
    const pair = generatePkcePair();

    expect(pair.codeChallengeMethod).toBe("S256");
    expect(pair.codeVerifier).toMatch(BASE64URL);
    expect(pair.codeChallenge).toMatch(BASE64URL);
    expect(pair.codeChallenge.length).toBe(43); // base64url(sha256) = 43 chars
    expect(pair.codeChallenge).toBe(deriveCodeChallenge(pair.codeVerifier));
  });
});
