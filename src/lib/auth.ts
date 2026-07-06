import type { NextAuthOptions } from "next-auth";
import GitHubProvider, { type GithubProfile } from "next-auth/providers/github";

import { env, isOwnerLogin } from "@/lib/env";
import { isOrgMember } from "@/lib/oauth/github-org";

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
 *
 * Allowlist (FR-022): sign-in is permitted if the GitHub `login` is on
 * `OWNER_GITHUB_LOGIN`, OR the signer is an active member of `OWNER_GITHUB_ORG`
 * (checked with the OAuth access token + `read:org` scope). Eligibility is
 * computed once here and stamped as `owner: true` on the JWT so per-request
 * guards can trust it cheaply (see `src/lib/oauth/session.ts`).
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      // `read:org` lets us verify org membership; `read:user` covers the profile.
      authorization: { params: { scope: "read:user read:org" } },
    }),
  ],
  session: { strategy: "jwt" },
  secret: env.NEXTAUTH_SECRET,
  pages: { signIn: "/signin" },
  callbacks: {
    // Allowlist gate: an owner login, or an active member of the configured org.
    async signIn({ profile, account }) {
      const login = (profile as GithubProfile | undefined)?.login;
      if (login && isOwnerLogin(login)) return true;

      const org = env.OWNER_GITHUB_ORG;
      const accessToken = account?.access_token;
      if (org && accessToken && (await isOrgMember(accessToken, org))) return true;

      return false;
    },
    // On first sign-in (`account` present) the allowlist already passed, so stamp
    // `owner` + the login onto the token; later guards read these from the JWT.
    jwt({ token, profile, account }) {
      const login = (profile as GithubProfile | undefined)?.login;
      if (login) {
        (token as { login?: string }).login = login;
      }
      if (account) {
        (token as { owner?: boolean }).owner = true;
      }
      return token;
    },
  },
};
