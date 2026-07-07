import { afterEach, describe, expect, it, vi } from "vitest";

// A complete, valid base environment (mirrors tests/unit/env.test.ts) so the
// eager `env = parseEnv()` in @/lib/env succeeds when team-login imports it.
const BASE_ENV: Record<string, string> = {
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

const TEAM_KEYS = ["TEAM_LOGIN_EMAIL", "TEAM_LOGIN_PASSWORD"] as const;

/** Load a fresh copy of the module with a controlled environment. */
async function loadTeamLogin(overrides: Record<string, string> = {}) {
  vi.resetModules();
  for (const key of TEAM_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries({ ...BASE_ENV, ...overrides })) {
    process.env[key] = value;
  }
  return import("@/lib/team-login");
}

afterEach(() => {
  for (const key of TEAM_KEYS) delete process.env[key];
  vi.resetModules();
});

describe("team-login (shared password sign-in)", () => {
  it("is disabled when no password is configured", async () => {
    const m = await loadTeamLogin();
    expect(m.teamLoginEnabled()).toBe(false);
    // Even with the right email, no password configured → always denied.
    expect(m.verifyTeamCredentials("support@mlscampus.com", "anything")).toBe(false);
  });

  it("defaults the email to support@mlscampus.com and accepts the right password", async () => {
    const m = await loadTeamLogin({ TEAM_LOGIN_PASSWORD: "s3cret-pass" });
    expect(m.teamLoginEnabled()).toBe(true);
    expect(m.TEAM_LOGIN_EMAIL).toBe("support@mlscampus.com");
    expect(m.verifyTeamCredentials("support@mlscampus.com", "s3cret-pass")).toBe(true);
  });

  it("normalizes the submitted email (case + surrounding whitespace)", async () => {
    const m = await loadTeamLogin({ TEAM_LOGIN_PASSWORD: "s3cret-pass" });
    expect(m.verifyTeamCredentials("  SUPPORT@MLSCampus.com  ", "s3cret-pass")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const m = await loadTeamLogin({ TEAM_LOGIN_PASSWORD: "s3cret-pass" });
    expect(m.verifyTeamCredentials("support@mlscampus.com", "wrong-pass")).toBe(false);
  });

  it("rejects a wrong email", async () => {
    const m = await loadTeamLogin({ TEAM_LOGIN_PASSWORD: "s3cret-pass" });
    expect(m.verifyTeamCredentials("intruder@example.com", "s3cret-pass")).toBe(false);
  });

  it("honors a custom TEAM_LOGIN_EMAIL", async () => {
    const m = await loadTeamLogin({
      TEAM_LOGIN_EMAIL: "team@mlscampus.com",
      TEAM_LOGIN_PASSWORD: "s3cret-pass",
    });
    expect(m.TEAM_LOGIN_EMAIL).toBe("team@mlscampus.com");
    expect(m.verifyTeamCredentials("team@mlscampus.com", "s3cret-pass")).toBe(true);
    expect(m.verifyTeamCredentials("support@mlscampus.com", "s3cret-pass")).toBe(false);
  });

  it("exposes a stable team identity for the session", async () => {
    const m = await loadTeamLogin({ TEAM_LOGIN_PASSWORD: "s3cret-pass" });
    expect(m.TEAM_USER).toMatchObject({ id: "team", email: "support@mlscampus.com" });
  });
});
