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
    expect(li).toMatchObject({ status: "CONNECTED", autoPublish: true });
    expect(li?.expiresAt).toBe("2030-01-01T00:00:00.000Z");

    const x = body.find((c) => c.platform === "X");
    expect(x).toMatchObject({ status: "DISCONNECTED", autoPublish: false, expiresAt: null });
  });

  it("NEVER exposes token material and never selects token columns", async () => {
    findMany.mockResolvedValue([
      { platform: "X", status: "CONNECTED", expiresAt: null, autoPublish: false },
    ]);

    const res = await GET(req());
    const raw = await res.text();
    expect(raw).not.toMatch(/accessToken|refreshToken/i);

    // The query explicitly selects only non-secret columns.
    const select = findMany.mock.calls[0]?.[0]?.select;
    expect(select).toBeDefined();
    expect(select.accessToken).toBeUndefined();
    expect(select.refreshToken).toBeUndefined();
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
