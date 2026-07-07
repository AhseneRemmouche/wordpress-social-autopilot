import { z } from "zod";

/**
 * Environment configuration (Constitution Principle II).
 *
 * Every variable the app needs is declared and validated here with Zod at
 * startup. If validation fails the process MUST refuse to boot. Error messages
 * list only variable NAMES — never values — so no secret can leak into logs.
 */

const nonEmpty = z.string().min(1);

/** A 32-byte key, supplied as base64, used for AES-256-GCM token encryption. */
const base64Key32 = z.string().refine(
  (value) => {
    try {
      return Buffer.from(value, "base64").length === 32;
    } catch {
      return false;
    }
  },
  { message: "must be 32-byte base64 (decodes to exactly 32 bytes)" },
);

export const envSchema = z.object({
  // --- Core ---
  DATABASE_URL: nonEmpty,
  NEXTAUTH_URL: z.url(),
  NEXTAUTH_SECRET: nonEmpty,
  APP_BASE_URL: z.url(),

  // --- Security ---
  WEBHOOK_SECRET: nonEmpty,
  TOKEN_ENCRYPTION_KEY: base64Key32,

  // --- Dashboard auth (GitHub) ---
  GITHUB_CLIENT_ID: nonEmpty,
  GITHUB_CLIENT_SECRET: nonEmpty,
  // Comma-separated GitHub usernames allowed to sign in (see parseOwnerLogins).
  OWNER_GITHUB_LOGIN: nonEmpty,
  // Optional: also allow any active member of this GitHub org (e.g. "MLS-Campus-Inc").
  OWNER_GITHUB_ORG: z.string().optional(),

  // --- Shared team login (optional) ---
  // When TEAM_LOGIN_PASSWORD is set, the whole team can sign in with a single
  // shared email + password and get full owner access — no per-person GitHub
  // account required. The email defaults to support@mlscampus.com; override
  // with TEAM_LOGIN_EMAIL. Unset password → the shared login is disabled and
  // the dashboard stays GitHub-only. Set the password only via the deploy
  // environment (Netlify), never in the repo.
  TEAM_LOGIN_EMAIL: z.email().optional(),
  TEAM_LOGIN_PASSWORD: z.string().min(8).optional(),

  // --- Claude ---
  ANTHROPIC_API_KEY: nonEmpty,

  // --- NovaMira MCP (WordPress fallback) ---
  NOVAMIRA_MCP_URL: z.url(),
  NOVAMIRA_MCP_TOKEN: nonEmpty,
  WORDPRESS_SITE_URL: z.url(),

  // --- LinkedIn ---
  LINKEDIN_CLIENT_ID: nonEmpty,
  LINKEDIN_CLIENT_SECRET: nonEmpty,

  // --- Meta (Facebook + Instagram) ---
  META_APP_ID: nonEmpty,
  META_APP_SECRET: nonEmpty,

  // --- X / Twitter ---
  X_CLIENT_ID: nonEmpty,
  X_CLIENT_SECRET: nonEmpty,

  // --- TikTok ---
  TIKTOK_CLIENT_KEY: nonEmpty,
  TIKTOK_CLIENT_SECRET: nonEmpty,

  // --- YouTube / Google ---
  GOOGLE_CLIENT_ID: nonEmpty,
  GOOGLE_CLIENT_SECRET: nonEmpty,

  // --- Worker cron tick (optional; only for the serverless /api/worker/tick runner) ---
  // When set, /api/worker/tick requires `Authorization: Bearer <CRON_SECRET>`.
  // When unset, that endpoint is DISABLED (503) — it never runs open.
  CRON_SECRET: z.string().min(1).optional(),

  // --- Alerts (optional) ---
  // Slack/Discord/Teams-compatible incoming webhook. When set, the worker posts a
  // short, secret-free message on a permanent publish failure or a soon-expiring
  // token. Unset → alerting is a silent no-op.
  ALERT_WEBHOOK_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate a source of environment values (defaults to `process.env`).
 * Throws a sanitized Error (variable names + reasons only) on failure.
 *
 * The parameter is a plain string map rather than `NodeJS.ProcessEnv` so test
 * fixtures (and `process.env`, which is assignable to it) both work.
 */
export function parseEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid environment configuration — refusing to start. ${problems}`,
    );
  }
  return result.data;
}

/**
 * Eagerly validated environment, evaluated at module load (refuse to boot on
 * invalid config). Import this for typed, guaranteed-present config values.
 */
export const env: Env = parseEnv();

/** Split a comma-separated owner allowlist into trimmed, non-empty logins. */
export function parseOwnerLogins(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** GitHub usernames explicitly allowed to access the dashboard. */
export const OWNER_GITHUB_LOGINS: readonly string[] = parseOwnerLogins(
  env.OWNER_GITHUB_LOGIN,
);

/** True if `login` is on the owner allowlist (`OWNER_GITHUB_LOGIN`). */
export function isOwnerLogin(login: string): boolean {
  return OWNER_GITHUB_LOGINS.includes(login);
}
