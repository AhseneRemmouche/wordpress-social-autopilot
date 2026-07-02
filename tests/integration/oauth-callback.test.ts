import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB boundary; use the real crypto/env/exchange logic.
vi.mock("@/lib/prisma", () => ({
  prisma: { platformAccount: { upsert: vi.fn() } },
}));

import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/oauth/[platform]/callback/route";

const upsert = prisma.platformAccount.upsert as unknown as Mock;

/** A fetch mock that routes by URL substring (token exchange + LinkedIn userinfo). */
function mockFetch(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (input: string | URL) => {
    const url = input.toString();
    const body = (data: unknown, ok = true, status = 200) =>
      ({ ok, status, json: async () => data }) as unknown as Response;

    if (url.includes("linkedin.com/oauth/v2/accessToken")) {
      return body(
        overrides.token ?? {
          access_token: "li-access-token",
          refresh_token: "li-refresh-token",
          expires_in: 3600,
          scope: "w_member_social",
        },
      );
    }
    if (url.includes("api.linkedin.com/v2/userinfo")) {
      return body(overrides.userinfo ?? { sub: "member-123" });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

function callbackRequest(query: string, cookie: string): Request {
  return new Request(`http://localhost:3000/api/oauth/linkedin/callback?${query}`, {
    headers: { cookie },
  });
}

const params = (platform = "linkedin") => Promise.resolve({ platform });

beforeEach(() => {
  upsert.mockReset().mockResolvedValue({});
});

describe("OAuth callback (contracts/oauth.md, FR-017/018)", () => {
  it("valid state → exchanges code, stores ENCRYPTED tokens, status CONNECTED", async () => {
    vi.stubGlobal("fetch", mockFetch());

    const res = await GET(
      callbackRequest("code=auth-code&state=s123", "wsa_oauth_state=s123"),
      { params: params() },
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/connections?connected=linkedin");

    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ platform: "LINKEDIN" });
    expect(arg.create.status).toBe("CONNECTED");

    // Tokens are encrypted at rest — the stored ciphertext must not equal the raw
    // value, and must decrypt back to it.
    expect(arg.create.accessToken).not.toBe("li-access-token");
    expect(decrypt(arg.create.accessToken)).toBe("li-access-token");
    expect(decrypt(arg.create.refreshToken)).toBe("li-refresh-token");
    // Member URN resolved from /userinfo (publisher author).
    expect(arg.create.externalAccountId).toBe("urn:li:person:member-123");

    vi.unstubAllGlobals();
  });

  it("missing/mismatched state → 400 and no token exchange", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(
      callbackRequest("code=auth-code&state=attacker", "wsa_oauth_state=s123"),
      { params: params() },
    );

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("absent state cookie → 400", async () => {
    vi.stubGlobal("fetch", mockFetch());
    const res = await GET(callbackRequest("code=c&state=s123", ""), { params: params() });
    expect(res.status).toBe(400);
    vi.unstubAllGlobals();
  });

  it("token exchange failure → redirect to /connections?error (no secrets)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 400, json: async () => ({}) }) as unknown as Response),
    );

    const res = await GET(
      callbackRequest("code=bad&state=s123", "wsa_oauth_state=s123"),
      { params: params() },
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/connections?error=connection_failed");
    expect(upsert).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("unknown platform → redirect with error", async () => {
    const res = await GET(callbackRequest("code=c&state=s", "wsa_oauth_state=s"), {
      params: params("bogus"),
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=unknown_platform");
  });
});
