/**
 * Local-only auth bypass for previewing the UI without GitHub sign-in.
 *
 * Enabled ONLY when NODE_ENV is not "production" AND `DEV_AUTH_BYPASS === "true"`.
 * The NODE_ENV guard means a production build (`next build` sets NODE_ENV=production)
 * can never skip authentication, regardless of the env var.
 */
export function devAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "true";
}

/** Placeholder identity shown in the shell while the bypass is active. */
export const DEV_USER = { name: "Dev User", email: "dev@localhost", image: null } as const;
