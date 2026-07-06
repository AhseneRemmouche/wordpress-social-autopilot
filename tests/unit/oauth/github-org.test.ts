import { describe, expect, it, vi } from "vitest";

import { isOrgMember } from "@/lib/oauth/github-org";

function mockFetch(impl: () => Promise<Response>): typeof fetch {
  return vi.fn(impl) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("isOrgMember", () => {
  it("true for an active member", async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ state: "active" })));
    expect(await isOrgMember("tok", "MLS-Campus-Inc", fetchImpl)).toBe(true);
  });

  it("false for a pending invitation (not yet joined)", async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ state: "pending" })));
    expect(await isOrgMember("tok", "MLS-Campus-Inc", fetchImpl)).toBe(false);
  });

  it("false when not a member (404)", async () => {
    const fetchImpl = mockFetch(() =>
      Promise.resolve(new Response("Not Found", { status: 404 })),
    );
    expect(await isOrgMember("tok", "MLS-Campus-Inc", fetchImpl)).toBe(false);
  });

  it("sends the bearer token to the user-memberships endpoint", async () => {
    const fn = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse({ state: "active" })));
    await isOrgMember("tok123", "My-Org", fn);

    const call = fn.mock.calls[0];
    expect(call?.[0]).toBe("https://api.github.com/user/memberships/orgs/My-Org");
    const headers = call?.[1]?.headers as Record<string, string> | undefined;
    expect(headers?.authorization).toBe("Bearer tok123");
  });

  it("fails closed (false) on a network error", async () => {
    const fetchImpl = mockFetch(() => Promise.reject(new Error("ECONNREFUSED")));
    expect(await isOrgMember("tok", "org", fetchImpl)).toBe(false);
  });
});
