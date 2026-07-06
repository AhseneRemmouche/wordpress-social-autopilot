/**
 * GitHub org-membership check for the dashboard allowlist.
 *
 * Uses the *authenticated user's own* membership endpoint
 * (`GET /user/memberships/orgs/{org}`) with the OAuth access token, so it works
 * for private members too — provided the token carries the `read:org` scope
 * (requested in {@link file://src/lib/auth.ts}). Returns false on any non-2xx
 * (404 = not a member) rather than throwing, so a membership check can never
 * crash sign-in.
 */

type FetchImpl = typeof fetch;

export async function isOrgMember(
  accessToken: string,
  org: string,
  fetchImpl: FetchImpl = fetch,
): Promise<boolean> {
  let res: Response;
  try {
    res = await fetchImpl(
      `https://api.github.com/user/memberships/orgs/${encodeURIComponent(org)}`,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/vnd.github+json",
          "user-agent": "wordpress-social-autopilot",
        },
      },
    );
  } catch {
    return false; // network error → treat as not a member (fail closed)
  }

  if (!res.ok) return false; // 404 = not a member, 403 = restricted, etc.

  const data = (await res.json().catch(() => null)) as { state?: unknown } | null;
  // "active" = current member; "pending" = invited but not yet joined.
  return data?.state === "active";
}
