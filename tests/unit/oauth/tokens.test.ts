import type { PlatformAccount } from "@prisma/client";
import {
  type Mock,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Reversible fakes so assertions can reason about encrypt/decrypt round-trips.
vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn((p: string) => `enc(${p})`),
  decrypt: vi.fn((c: string) => c.replace(/^enc\((.*)\)$/, "$1")),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { platformAccount: { update: vi.fn() } },
}));

import { getValidAccessToken, refreshAccessToken, TokenError } from "@/lib/oauth/tokens";
import { prisma } from "@/lib/prisma";

const updateMock = prisma.platformAccount.update as unknown as Mock;
let fetchMock: Mock;

function account(overrides: Partial<PlatformAccount> = {}): PlatformAccount {
  return {
    platform: "X",
    status: "CONNECTED",
    accessToken: "enc(access-1)",
    refreshToken: "enc(refresh-1)",
    expiresAt: new Date(Date.now() + 3_600_000), // not near expiry by default
    ...overrides,
  } as PlatformAccount;
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface UpdateArg {
  where: { platform: string };
  data: Record<string, unknown>;
}
function updateCall(i = 0): UpdateArg | undefined {
  return updateMock.mock.calls[i]?.[0] as UpdateArg | undefined;
}

beforeEach(() => {
  updateMock.mockReset().mockResolvedValue({});
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tokens (FR-019/FR-020, Principle VII)", () => {
  it("passes through the decrypted token when it is not near expiry", async () => {
    const token = await getValidAccessToken(account());

    expect(token).toBe("access-1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("throws when no access token is stored", async () => {
    await expect(getValidAccessToken(account({ accessToken: null }))).rejects.toBeInstanceOf(
      TokenError,
    );
  });

  it("proactively refreshes near expiry and persists the rotated refresh token (X)", async () => {
    const acc = account({ platform: "X", expiresAt: new Date(Date.now() - 1000) });
    fetchMock.mockResolvedValue(
      json({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 7200 }),
    );

    const token = await getValidAccessToken(acc);

    expect(token).toBe("new-access");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.x.com/2/oauth2/token");

    // The refresh grant sent the decrypted old refresh token + Basic auth.
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = init.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("refresh-1");
    expect((init.headers as Record<string, string>).Authorization).toContain("Basic ");

    // Persisted: rotated refresh token, new access token, CONNECTED, fresh expiry.
    const upd = updateCall();
    expect(upd?.where).toEqual({ platform: "X" });
    expect(upd?.data.accessToken).toBe("enc(new-access)");
    expect(upd?.data.refreshToken).toBe("enc(new-refresh)");
    expect(upd?.data.status).toBe("CONNECTED");
    expect(upd?.data.expiresAt).toBeInstanceOf(Date);
  });

  it("does not rotate the refresh token when the provider omits one (Google/YouTube)", async () => {
    const acc = account({ platform: "YOUTUBE", expiresAt: new Date(Date.now() - 1000) });
    fetchMock.mockResolvedValue(json({ access_token: "g-access", expires_in: 3600 }));

    const token = await refreshAccessToken(acc);

    expect(token).toBe("g-access");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://oauth2.googleapis.com/token");
    const upd = updateCall();
    expect(upd?.data.accessToken).toBe("enc(g-access)");
    expect(upd?.data.refreshToken).toBeUndefined(); // not rotated
  });

  it("marks TOKEN_EXPIRED (no fetch) when the provider has no refresh grant (Meta)", async () => {
    // Meta uses no grant_type=refresh_token flow (its Page token is non-expiring),
    // so a direct refresh attempt fails closed without any network call.
    const acc = account({ platform: "FACEBOOK" });

    await expect(refreshAccessToken(acc)).rejects.toBeInstanceOf(TokenError);
    expect(fetchMock).not.toHaveBeenCalled();
    const upd = updateCall();
    expect(upd?.where).toEqual({ platform: "FACEBOOK" });
    expect(upd?.data.status).toBe("TOKEN_EXPIRED");
  });

  it("refreshes LinkedIn via client_id/client_secret body when a refresh token is present", async () => {
    const acc = account({ platform: "LINKEDIN", expiresAt: new Date(Date.now() - 1000) });
    fetchMock.mockResolvedValue(
      json({ access_token: "li-access", refresh_token: "li-refresh", expires_in: 5_184_000 }),
    );

    const token = await getValidAccessToken(acc);

    expect(token).toBe("li-access");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://www.linkedin.com/oauth/v2/accessToken");

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = init.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("refresh-1");
    expect(body.get("client_id")).toBeTruthy();
    expect(body.get("client_secret")).toBeTruthy();
    // LinkedIn uses body credentials, not Basic auth (that's X).
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();

    // Rotated refresh token + new access token persisted.
    const upd = updateCall();
    expect(upd?.data.accessToken).toBe("enc(li-access)");
    expect(upd?.data.refreshToken).toBe("enc(li-refresh)");
  });

  it("marks TOKEN_EXPIRED (no fetch) when the refresh token is missing", async () => {
    const acc = account({ platform: "X", refreshToken: null });

    await expect(refreshAccessToken(acc)).rejects.toBeInstanceOf(TokenError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateCall()?.data.status).toBe("TOKEN_EXPIRED");
  });

  it("sets TOKEN_EXPIRED when the refresh grant fails (HTTP 400)", async () => {
    const acc = account({ platform: "X", expiresAt: new Date(Date.now() - 1000) });
    fetchMock.mockResolvedValue(new Response("bad", { status: 400 }));

    await expect(refreshAccessToken(acc)).rejects.toBeInstanceOf(TokenError);
    const expired = updateMock.mock.calls.find(
      (c) => (c[0] as UpdateArg | undefined)?.data.status === "TOKEN_EXPIRED",
    );
    expect(expired).toBeTruthy();
  });

  it("does not leak the token in the error when refresh fails", async () => {
    const acc = account({ platform: "X", expiresAt: new Date(Date.now() - 1000) });
    fetchMock.mockResolvedValue(new Response("bad", { status: 400 }));

    await refreshAccessToken(acc).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain("refresh-1");
      expect(message).not.toContain("access-1");
    });
  });
});
