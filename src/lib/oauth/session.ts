import { getToken } from "next-auth/jwt";

import { devAuthBypassEnabled } from "@/lib/dev";
import { env } from "@/lib/env";

/**
 * Owner-session guard for the OAuth + connections routes (FR-022).
 *
 * Reads the NextAuth JWT session cookie using only `NEXTAUTH_SECRET` — it does
 * not depend on the full NextAuth options module, so it works before/independently
 * of the dashboard auth wiring. The owner allowlist is enforced at sign-in
 * (NextAuth `signIn` callback); here we additionally re-check the `login` claim
 * when present. Returns true iff a valid owner session cookie is presented.
 *
 * This module is deliberately tiny so route tests can `vi.mock` it.
 */
export async function requireOwner(request: Request): Promise<boolean> {
  if (devAuthBypassEnabled()) return true; // local-only preview bypass
  const token = await getToken({
    // next-auth reads cookies off the request; NextRequest and Request both carry them.
    req: request as Parameters<typeof getToken>[0]["req"],
    secret: env.NEXTAUTH_SECRET,
  });

  if (!token) return false;

  const login = (token as { login?: unknown }).login;
  // If a login claim is present it must match the owner; absence (older token)
  // still passes because the allowlist was enforced at sign-in.
  return typeof login !== "string" || login === env.OWNER_GITHUB_LOGIN;
}
