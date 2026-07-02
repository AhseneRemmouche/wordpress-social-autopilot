import type { NextAuthOptions } from "next-auth";
import GitHubProvider, { type GithubProfile } from "next-auth/providers/github";

import { env } from "@/lib/env";

/**
 * NextAuth v4 configuration (FR-022, plan §7). This is a single-owner dashboard:
 * GitHub is the only identity provider, sessions are stateless JWTs, and the
 * `signIn` callback allowlists exactly ONE GitHub login (`OWNER_GITHUB_LOGIN`).
 *
 * The GitHub `login` is also persisted on the JWT (jwt callback) so server-side
 * guards — e.g. `src/lib/oauth/session.ts` used by the OAuth/connections routes —
 * can re-verify ownership from the session cookie alone, using the same
 * `NEXTAUTH_SECRET` this config signs with.
 *
 * Verified against the installed next-auth@4.24.14 type definitions:
 * `GithubProfile.login: string`, `SessionStrategy = "jwt"`, and the `signIn`/`jwt`
 * callback parameter shapes.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  secret: env.NEXTAUTH_SECRET,
  pages: { signIn: "/signin" },
  callbacks: {
    // Allowlist gate (FR-022): only the configured owner may complete sign-in.
    // The GitHub OAuth profile carries the account's `login` (username).
    signIn({ profile }) {
      const login = (profile as GithubProfile | undefined)?.login;
      return login === env.OWNER_GITHUB_LOGIN;
    },
    // Stamp the GitHub login onto the token on first sign-in so downstream
    // server guards can confirm ownership without another provider round-trip.
    jwt({ token, profile }) {
      const login = (profile as GithubProfile | undefined)?.login;
      if (login) {
        (token as { login?: string }).login = login;
      }
      return token;
    },
  },
};
