import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Shared "team login": one email + password that the whole team uses to sign in
 * with full owner access, so nobody needs an individual GitHub account. Wired as
 * a NextAuth Credentials provider in {@link file://src/lib/auth.ts}.
 *
 * The password lives ONLY in the deploy environment (`TEAM_LOGIN_PASSWORD`), is
 * never persisted, and is compared in constant time. When it is unset the login
 * is disabled entirely (fail-closed) and the dashboard stays GitHub-only.
 */

/** The shared account's email (defaults to support@mlscampus.com), normalized. */
export const TEAM_LOGIN_EMAIL = (
  env.TEAM_LOGIN_EMAIL ?? "support@mlscampus.com"
).toLowerCase();

/** The identity every team-login session resolves to. */
export const TEAM_USER = {
  id: "team",
  name: "MLS Campus Team",
  email: TEAM_LOGIN_EMAIL,
} as const;

/** True when the shared login is configured (a password is set). */
export function teamLoginEnabled(): boolean {
  return Boolean(env.TEAM_LOGIN_PASSWORD);
}

/**
 * Constant-time equality for two secret strings. Both sides are HMACed to a
 * fixed-length digest first, so `timingSafeEqual` never sees unequal-length
 * buffers (which would throw and leak length via the error path).
 */
function safeEqual(a: string, b: string): boolean {
  const key = "wsa-team-login"; // fixed; only used to normalize length, not for secrecy
  const da = createHmac("sha256", key).update(a).digest();
  const db = createHmac("sha256", key).update(b).digest();
  return timingSafeEqual(da, db);
}

/**
 * Verify a submitted email + password against the shared team credentials.
 * Returns false (never throws) when the login is disabled or either field is
 * wrong. Both fields are always checked so timing does not reveal which failed.
 */
export function verifyTeamCredentials(email: string, password: string): boolean {
  const expected = env.TEAM_LOGIN_PASSWORD;
  if (!expected) return false; // disabled → deny
  const emailOk = email.trim().toLowerCase() === TEAM_LOGIN_EMAIL;
  const passwordOk = safeEqual(password, expected);
  return emailOk && passwordOk;
}
