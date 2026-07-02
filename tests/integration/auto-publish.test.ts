import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { platformAccount: { upsert: vi.fn() } },
}));
vi.mock("@/lib/oauth/session", () => ({ requireOwner: vi.fn() }));

import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";
import { PATCH } from "@/app/api/settings/auto-publish/route";

const upsert = prisma.platformAccount.upsert as unknown as Mock;
const requireOwnerMock = requireOwner as unknown as Mock;

function patch(body: unknown): Promise<Response> {
  return PATCH(
    new Request("http://localhost:3000/api/settings/auto-publish", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  requireOwnerMock.mockReset().mockResolvedValue(true);
  upsert.mockReset().mockResolvedValue({});
});

describe("PATCH /api/settings/auto-publish (FR-025, Principle VII)", () => {
  it("toggles one platform on and persists it (scoped to that platform)", async () => {
    const res = await patch({ platform: "LINKEDIN", autoPublish: true });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ platform: "LINKEDIN", autoPublish: true });

    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ platform: "LINKEDIN" });
    expect(arg.update).toEqual({ autoPublish: true });
  });

  it("toggles a different platform off without touching others", async () => {
    const res = await patch({ platform: "X", autoPublish: false });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ platform: "X", autoPublish: false });

    // Only the X row is written — the update is a single-field, single-platform write.
    expect(upsert).toHaveBeenCalledTimes(1);
    const arg = upsert.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ platform: "X" });
    expect(arg.update).toEqual({ autoPublish: false });
  });

  it("401 unauthenticated (no write)", async () => {
    requireOwnerMock.mockResolvedValue(false);
    const res = await patch({ platform: "LINKEDIN", autoPublish: true });
    expect(res.status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("400 on an invalid body (bad platform, missing/mistyped flag, bad JSON)", async () => {
    expect((await patch({ platform: "MYSPACE", autoPublish: true })).status).toBe(400);
    expect((await patch({ platform: "LINKEDIN" })).status).toBe(400);
    expect((await patch({ platform: "LINKEDIN", autoPublish: "yes" })).status).toBe(400);
    expect((await patch("{ not json")).status).toBe(400);

    expect(upsert).not.toHaveBeenCalled();
  });
});
