import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider, { type GithubProfile } from "next-auth/providers/github";

import { env, isOwnerLogin } from "@/lib/env";
import { isOrgMember } from "@/lib/oauth/github-org";
import { TEAM_USER, teamLoginEnabled, verifyTeamCredentials } from "@/lib/team-login";

/** Provider id for the shared team email+password login. */
export const TEAM_PROVIDER_ID = "team";

/**
 * Optional shared team login (see {@link file://src/lib/team-login.ts}): one
 * email+password the whole team uses. Only registered when a password is
 * configured; `authorize` fully validates the credentials, so the `signIn`
 * callback can trust this provider unconditionally.
 */
const teamProvider = CredentialsProvider({
  id: TEAM_PROVIDER_ID,
  name: "Team login",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  authorize(credentials) {
    const email = credentials?.email ?? "";
    const password = credentials?.password ?? "";
    if (!verifyTeamCredentials(email, password)) return null;
    return { id: TEAM_USER.id, name: TEAM_USER.name, email: TEAM_USER.email };
  },
});

/**
 * NextAuth v4 configuration (FR-022, plan §7). Sessions are stateless JWTs. Two
 * ways in, both granting the same full owner access: GitHub OAuth (allowlisted by
 * `OWNER_GITHUB_LOGIN` / `OWNER_GITHUB_ORG`), and an optional shared team
 * email+password login (`TEAM_LOGIN_PASSWORD`; see team-login.ts) so the whole
 * team can work without individual GitHub accounts.
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
const providers: NextAuthOptions["providers"] = [
  GitHubProvider({
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    // `read:org` lets us verify org membership; `read:user` covers the profile.
    authorization: { params: { scope: "read:user read:org" } },
  }),
];
if (teamLoginEnabled()) providers.push(teamProvider);

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: "jwt" },
  secret: env.NEXTAUTH_SECRET,
  pages: { signIn: "/signin" },
  callbacks: {
    // Allowlist gate: the shared team login (already validated in `authorize`),
    // an owner GitHub login, or an active member of the configured org.
    async signIn({ profile, account }) {
      if (account?.provider === TEAM_PROVIDER_ID) return true;

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
