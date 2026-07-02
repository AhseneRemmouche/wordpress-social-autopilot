// Global Vitest setup (runs before each test file's imports).
//
// Seeds a complete, valid environment so any module that imports `@/lib/env`
// (which validates eagerly at module load) can be imported under test. Uses
// `??=` so it never clobbers values already provided (e.g. a real `.env` or CI).

const TEST_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: "test-nextauth-secret",
  APP_BASE_URL: "http://localhost:3000",
  WEBHOOK_SECRET: "test-webhook-secret",
  // Deterministic 32-byte key (base64) for AES-256-GCM.
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
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

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] ??= value;
}
