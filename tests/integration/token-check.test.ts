import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

// Mutable mocked env to control CRON_SECRET per test.
const h = vi.hoisted(() => ({
  env: { CRON_SECRET: undefined as string | undefined, ALERT_WEBHOOK_URL: undefined as string | undefined },
}));
vi.mock("@/lib/env", () => ({ env: h.env }));
vi.mock("@/lib/prisma", () => ({
  prisma: { platformAccount: { findMany: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/alert", () => ({ sendAlert: vi.fn() }));

import { sendAlert } from "@/lib/alert";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/worker/token-check/route";

const findMany = prisma.platformAccount.findMany as unknown as Mock;
const updateAcct = prisma.platformAccount.update as unknown as Mock;
const alertMock = sendAlert as unknown as Mock;

function req(method: string, auth?: string): Request {
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers.authorization = auth;
  return new Request("http://localhost/api/worker/token-check", { method, headers });
}

// A connected account expiring in ~3 days.
function acct(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    platform: "LINKEDIN",
    status: "CONNECTED",
    expiresAt: new Date(Date.now() + 3 * 86_400_000),
    metadata: null,
    ...over,
  };
}

beforeEach(() => {
  h.env.CRON_SECRET = undefined;
  findMany.mockReset().mockResolvedValue([]);
  updateAcct.mockReset().mockResolvedValue({});
  alertMock.mockReset();
});

describe("/api/worker/token-check — fail-closed expiry reminder", () => {
  it("503 (disabled) when CRON_SECRET is unset", async () => {
    expect((await GET(req("GET"))).status).toBe(503);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("401 on a missing/wrong bearer", async () => {
    h.env.CRON_SECRET = "s3cret";
    expect((await POST(req("POST", "Bearer nope"))).status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("reminds only genuinely-expiring accounts; skips auto-renewing ones", async () => {
    h.env.CRON_SECRET = "s3cret";
    findMany.mockResolvedValue([
      acct({ platform: "LINKEDIN", refreshToken: null }), // no refresh token → remind
      acct({ platform: "X", refreshToken: "enc(x)" }), // refresh provider + token → skip
      acct({ platform: "FACEBOOK", refreshToken: null }), // Meta Page token non-expiring → skip
    ]);

    const res = await POST(req("POST", "Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, checked: 3, alerted: 1 });

    expect(alertMock).toHaveBeenCalledOnce();
    expect(alertMock.mock.calls[0]?.[0]).toContain("LINKEDIN");
    // Stamps the throttle marker on the alerted account only.
    expect(updateAcct).toHaveBeenCalledOnce();
    const call = updateAcct.mock.calls[0]?.[0] as { where: unknown; data: { metadata: Record<string, unknown> } };
    expect(call.where).toEqual({ platform: "LINKEDIN" });
    expect(typeof call.data.metadata.lastExpiryAlertAt).toBe("string");
  });

  it("throttles: an account alerted within the window is not re-alerted", async () => {
    h.env.CRON_SECRET = "s3cret";
    findMany.mockResolvedValue([
      acct({ platform: "LINKEDIN", metadata: { lastExpiryAlertAt: new Date().toISOString() } }),
    ]);

    const res = await POST(req("POST", "Bearer s3cret"));
    expect(await res.json()).toEqual({ ok: true, checked: 1, alerted: 0 });
    expect(alertMock).not.toHaveBeenCalled();
    expect(updateAcct).not.toHaveBeenCalled();
  });
});
