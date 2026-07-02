import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/oauth/session", () => ({ requireOwner: vi.fn() }));

import { env } from "@/lib/env";
import { requireOwner } from "@/lib/oauth/session";
import { GET } from "@/app/api/oauth/[platform]/start/route";

const requireOwnerMock = requireOwner as unknown as Mock;

function start(slug: string): Promise<Response> {
  return GET(new Request(`http://localhost:3000/api/oauth/${slug}/start`), {
    params: Promise.resolve({ platform: slug }),
  });
}

async function location(slug: string): Promise<{ res: Response; url: URL; cookie: string }> {
  const res = await start(slug);
  const loc = res.headers.get("location");
  expect(loc).toBeTruthy();
  return { res, url: new URL(loc ?? ""), cookie: res.headers.get("set-cookie") ?? "" };
}

beforeEach(() => {
  requireOwnerMock.mockReset().mockResolvedValue(true);
});

describe("OAuth start (contracts/oauth.md, FR-017)", () => {
  it("401 when not the owner", async () => {
    requireOwnerMock.mockResolvedValue(false);
    expect((await start("linkedin")).status).toBe(401);
  });

  it("404 on an unknown platform", async () => {
    expect((await start("bogus")).status).toBe(404);
  });

  it("LinkedIn → 302 authorize URL with scopes + state cookie, no PKCE", async () => {
    const { res, url, cookie } = await location("linkedin");

    expect(res.status).toBe(302);
    expect(`${url.origin}${url.pathname}`).toBe("https://www.linkedin.com/oauth/v2/authorization");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe(env.LINKEDIN_CLIENT_ID);
    expect(url.searchParams.get("scope")).toContain("w_member_social");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("code_challenge")).toBeNull();

    expect(cookie).toContain("wsa_oauth_state");
    expect(cookie).not.toContain("wsa_oauth_verifier");
  });

  it("X → includes the S256 PKCE challenge + verifier cookie", async () => {
    const { url, cookie } = await location("x");

    expect(`${url.origin}${url.pathname}`).toBe("https://x.com/i/oauth2/authorize");
    expect(url.searchParams.get("client_id")).toBe(env.X_CLIENT_ID);
    expect(url.searchParams.get("scope")).toContain("tweet.write");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");

    expect(cookie).toContain("wsa_oauth_verifier");
  });

  it("TikTok → uses client_key + comma-delimited scopes + PKCE", async () => {
    const { url } = await location("tiktok");

    expect(`${url.origin}${url.pathname}`).toBe("https://www.tiktok.com/v2/auth/authorize/");
    expect(url.searchParams.get("client_key")).toBe(env.TIKTOK_CLIENT_KEY);
    expect(url.searchParams.get("client_id")).toBeNull();

    const scope = url.searchParams.get("scope") ?? "";
    expect(scope).toContain("video.publish");
    expect(scope.split(",").length).toBeGreaterThanOrEqual(3); // comma-delimited
    expect(scope).not.toContain(" ");

    expect(url.searchParams.get("code_challenge")).toBeTruthy();
  });

  it("Google/YouTube → offline access + forced consent for a refresh token", async () => {
    const { url } = await location("youtube");

    expect(`${url.origin}${url.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toContain("youtube.readonly");
  });
});
