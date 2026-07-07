import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB and the owner-session guard (auth is exercised in its own tests).
vi.mock("@/lib/prisma", () => ({
  prisma: { platformAccount: { findMany: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("@/lib/oauth/session", () => ({ requireOwner: vi.fn() }));

import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";
import { DELETE, GET } from "@/app/api/connections/route";

const findMany = prisma.platformAccount.findMany as unknown as Mock;
const updateMany = prisma.platformAccount.updateMany as unknown as Mock;
const requireOwnerMock = requireOwner as unknown as Mock;

const req = (url = "http://localhost:3000/api/connections") => new Request(url);

beforeEach(() => {
  requireOwnerMock.mockReset().mockResolvedValue(true);
  findMany.mockReset().mockResolvedValue([]);
  updateMany.mockReset().mockResolvedValue({ count: 1 });
});

describe("GET /api/connections (FR-018/020)", () => {
  it("returns all six platforms, defaulting missing rows to DISCONNECTED", async () => {
    findMany.mockResolvedValue([
      {
        platform: "LINKEDIN",
        status: "CONNECTED",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        autoPublish: true,
      },
    ]);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;

    expect(body).toHaveLength(6);
    const li = body.find((c) => c.platform === "LINKEDIN");
    // LinkedIn tokens don't refresh — they expire and need reconnect.
    expect(li).toMatchObject({ status: "CONNECTED", autoPublish: true, autoRenews: false });
    expect(li?.expiresAt).toBe("2030-01-01T00:00:00.000Z");

    const x = body.find((c) => c.platform === "X");
    // Disconnected X has no stored refresh token, so it does not auto-renew yet
    // (the card only surfaces auto-renew for CONNECTED accounts anyway).
    expect(x).toMatchObject({
      status: "DISCONNECTED",
      autoPublish: false,
      expiresAt: null,
      autoRenews: false,
    });
  });

  it("auto-renews: Meta always; refresh providers only while holding a refresh token (FR-020)", async () => {
    findMany.mockResolvedValue([
      // Refresh provider WITH a stored refresh token → auto-renews.
      { platform: "X", status: "CONNECTED", expiresAt: null, autoPublish: false, refreshToken: "enc(x)" },
      // Meta Page token is non-expiring → auto-renews even with no refresh token.
      { platform: "FACEBOOK", status: "CONNECTED", expiresAt: null, autoPublish: false, refreshToken: null },
      // Refresh provider WITHOUT a refresh token (LinkedIn app not provisioned) → honest expiry.
      {
        platform: "LINKEDIN",
        status: "CONNECTED",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        autoPublish: false,
        refreshToken: null,
      },
    ]);

    const res = await GET(req());
    const body = (await res.json()) as Array<{ platform: string; autoRenews: boolean }>;
    const autoRenews = Object.fromEntries(body.map((c) => [c.platform, c.autoRenews]));

    expect(autoRenews.X).toBe(true); // refresh provider + token
    expect(autoRenews.FACEBOOK).toBe(true); // Meta non-expiring
    expect(autoRenews.INSTAGRAM).toBe(true); // Meta non-expiring (missing row)
    expect(autoRenews.LINKEDIN).toBe(false); // refresh provider, no token → honest
    expect(autoRenews.TIKTOK).toBe(false); // missing row → no token
    expect(autoRenews.YOUTUBE).toBe(false); // missing row → no token
  });

  it("NEVER exposes token material in the response", async () => {
    findMany.mockResolvedValue([
      { platform: "X", status: "CONNECTED", expiresAt: null, autoPublish: false, refreshToken: "enc(x)" },
    ]);

    const res = await GET(req());
    const raw = await res.text();
    // No token ciphertext value leaks into the JSON (only the derived boolean).
    expect(raw).not.toContain("enc(x)");
    expect(raw).not.toMatch(/accessToken/i);

    // accessToken is never even read; refreshToken is read ONLY to derive the boolean.
    const select = findMany.mock.calls[0]?.[0]?.select;
    expect(select).toBeDefined();
    expect(select.accessToken).toBeUndefined();
    expect(select.refreshToken).toBe(true);
  });

  it("401 when not the owner", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/connections (FR-021)", () => {
  it("purges tokens and sets DISCONNECTED for the platform", async () => {
    const res = await DELETE(req("http://localhost:3000/api/connections?platform=x"));
    expect(res.status).toBe(200);

    const arg = updateMany.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ platform: "X" });
    expect(arg.data).toMatchObject({
      status: "DISCONNECTED",
      accessToken: null,
      refreshToken: null,
    });
  });

  it("400 on an unknown/missing platform", async () => {
    expect((await DELETE(req("http://localhost:3000/api/connections?platform=bogus"))).status).toBe(400);
    expect((await DELETE(req("http://localhost:3000/api/connections"))).status).toBe(400);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("401 when not the owner", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await DELETE(req("http://localhost:3000/api/connections?platform=x"));
    expect(res.status).toBe(401);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
