import { env } from "@/lib/env";

/**
 * Short-lived, HTTP-only cookies that carry OAuth CSRF `state` and the PKCE
 * `code_verifier` from the start redirect to the callback (contracts/oauth.md).
 * Scoped to the OAuth path and marked Secure when the app runs over HTTPS.
 */

export const STATE_COOKIE = "wsa_oauth_state";
export const VERIFIER_COOKIE = "wsa_oauth_verifier";

const COOKIE_PATH = "/api/oauth";
const TEN_MINUTES = 600;

const secure = env.APP_BASE_URL.startsWith("https");

function attrs(maxAge: number): string {
  const parts = [
    `Path=${COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Serialize a Set-Cookie value for a short-lived OAuth cookie. */
export function serializeOAuthCookie(name: string, value: string): string {
  return `${name}=${encodeURIComponent(value)}; ${attrs(TEN_MINUTES)}`;
}

/** Serialize a Set-Cookie value that immediately expires the named cookie. */
export function clearOAuthCookie(name: string): string {
  return `${name}=; ${attrs(0)}`;
}

/** Read a cookie value from a request's Cookie header (returns undefined if absent). */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() === name) {
      return decodeURIComponent(pair.slice(eq + 1).trim());
    }
  }
  return undefined;
}
