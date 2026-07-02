import { beforeAll, describe, expect, it, vi } from "vitest";

import type { parseEnv as ParseEnvFn } from "@/lib/env";

// A complete, valid environment fixture (24 variables). The encryption key is
// exactly 32 bytes encoded as base64.
const VALID_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/wsa",
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: "test-nextauth-secret",
  APP_BASE_URL: "http://localhost:3000",
  WEBHOOK_SECRET: "test-webhook-secret",
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
  GITHUB_CLIENT_ID: "gh-client-id",
  GITHUB_CLIENT_SECRET: "gh-client-secret",
  OWNER_GITHUB_LOGIN: "owner",
  ANTHROPIC_API_KEY: "sk-ant-test",
  NOVAMIRA_MCP_URL: "https://mcp.example.com",
  NOVAMIRA_MCP_TOKEN: "novamira-token",
  WORDPRESS_SITE_URL: "https://blog.example.com",
  LINKEDIN_CLIENT_ID: "li-id",
  LINKEDIN_CLIENT_SECRET: "li-secret",
  META_APP_ID: "meta-id",
  META_APP_SECRET: "meta-secret",
  X_CLIENT_ID: "x-id",
  X_CLIENT_SECRET: "x-secret",
  TIKTOK_CLIENT_KEY: "tt-key",
  TIKTOK_CLIENT_SECRET: "tt-secret",
  GOOGLE_CLIENT_ID: "g-id",
  GOOGLE_CLIENT_SECRET: "g-secret",
};

let parseEnv: typeof ParseEnvFn;

beforeAll(async () => {
  // Seed a complete valid env so the module's eager `env = parseEnv()` succeeds
  // at import time; then grab the pure `parseEnv` for fixture-based tests.
  for (const [key, value] of Object.entries(VALID_ENV)) {
    process.env[key] = value;
  }
  ({ parseEnv } = await import("@/lib/env"));
});

describe("env schema (Principle II / VII)", () => {
  it("parses a complete, valid environment", () => {
    const parsed = parseEnv(VALID_ENV);
    expect(parsed.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
    expect(parsed.OWNER_GITHUB_LOGIN).toBe("owner");
    expect(parsed.TOKEN_ENCRYPTION_KEY).toBe(VALID_ENV.TOKEN_ENCRYPTION_KEY);
  });

  it("throws when a required variable is missing (and names it)", () => {
    const incomplete: Record<string, string | undefined> = { ...VALID_ENV };
    delete incomplete["WEBHOOK_SECRET"];
    expect(() => parseEnv(incomplete)).toThrow(/WEBHOOK_SECRET/);
  });

  it("throws when a required URL is malformed (and names it)", () => {
    expect(() => parseEnv({ ...VALID_ENV, NEXTAUTH_URL: "not-a-url" })).toThrow(
      /NEXTAUTH_URL/,
    );
  });

  it("throws on a TOKEN_ENCRYPTION_KEY of the wrong byte length", () => {
    // Valid base64, but only 16 bytes — not 32.
    const sixteenBytes = Buffer.alloc(16).toString("base64");
    expect(() =>
      parseEnv({ ...VALID_ENV, TOKEN_ENCRYPTION_KEY: sixteenBytes }),
    ).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it("throws on a TOKEN_ENCRYPTION_KEY that is not 32-byte base64", () => {
    expect(() =>
      parseEnv({ ...VALID_ENV, TOKEN_ENCRYPTION_KEY: "too-short" }),
    ).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });

  it("does not leak secret values in the thrown error message", () => {
    const badSecret = "SUPER-SECRET-VALUE-should-not-appear";
    try {
      parseEnv({ ...VALID_ENV, NEXTAUTH_URL: "bad", WEBHOOK_SECRET: badSecret });
      expect.unreachable("parseEnv should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(badSecret);
    }
  });

  it("refuses to boot: importing the module throws on invalid process.env", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    try {
      delete process.env.ANTHROPIC_API_KEY;
      vi.resetModules();
      await expect(import("@/lib/env")).rejects.toThrow(/ANTHROPIC_API_KEY/);
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
      vi.resetModules();
    }
  });
});
