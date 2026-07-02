import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Prisma singleton so no DB/env is needed.
vi.mock("@/lib/prisma", () => ({
  prisma: { auditLog: { create: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { redactSecrets, writeAudit } from "@/lib/audit";

const createMock = prisma.auditLog.create as unknown as Mock;

beforeEach(() => {
  createMock.mockReset();
});

describe("writeAudit (Principle V / VII)", () => {
  it.each(["ATTEMPT", "SUCCESS", "FAILURE"] as const)(
    "records all fields for outcome %s",
    async (outcome) => {
      let captured: Record<string, unknown> | undefined;
      createMock.mockImplementation((arg: { data: Record<string, unknown> }) => {
        captured = arg.data;
        return Promise.resolve({ id: "audit-1" });
      });

      const result = await writeAudit({
        contentId: "content-123",
        platform: "LINKEDIN",
        attempt: 2,
        outcome,
        externalId: "ext-9",
      });

      expect(createMock).toHaveBeenCalledOnce();
      expect(captured).toMatchObject({
        platform: "LINKEDIN",
        attempt: 2,
        outcome,
        externalId: "ext-9",
        content: { connect: { id: "content-123" } },
      });
      expect(result).toEqual({ id: "audit-1" });
    },
  );

  it("omits errorContext when not provided", async () => {
    let captured: Record<string, unknown> | undefined;
    createMock.mockImplementation((arg: { data: Record<string, unknown> }) => {
      captured = arg.data;
      return Promise.resolve({ id: "a" });
    });

    await writeAudit({
      contentId: "c1",
      platform: "X",
      attempt: 1,
      outcome: "SUCCESS",
    });

    expect(captured).toBeDefined();
    expect(captured).not.toHaveProperty("errorContext");
  });

  it("redacts secrets in errorContext before storing (no secret value survives)", async () => {
    let captured: Record<string, unknown> | undefined;
    createMock.mockImplementation((arg: { data: Record<string, unknown> }) => {
      captured = arg.data;
      return Promise.resolve({ id: "a" });
    });

    const secrets = [
      "SECRET-ACCESS",
      "SECRET-REFRESH",
      "SECRET-CLIENT",
      "SECRET-BEARER",
      "SECRET-SIG",
      "SECRET-APIKEY",
      "SECRET-PW",
      "SECRET-DEEP",
    ];

    await writeAudit({
      contentId: "c1",
      platform: "FACEBOOK",
      attempt: 1,
      outcome: "FAILURE",
      errorContext: {
        status: 401,
        accessToken: "SECRET-ACCESS",
        refreshToken: "SECRET-REFRESH",
        clientSecret: "SECRET-CLIENT",
        headers: {
          Authorization: "Bearer SECRET-BEARER",
          "x-wsa-signature": "SECRET-SIG",
        },
        apiKey: "SECRET-APIKEY",
        password: "SECRET-PW",
        nested: { deep: { token: "SECRET-DEEP" } },
        author: "Jane Doe",
        message: "Unauthorized",
      },
    });

    const serialized = JSON.stringify(captured?.errorContext);
    for (const secret of secrets) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).toContain("[REDACTED]");
    // Non-secret context is preserved.
    expect(serialized).toContain("Jane Doe");
    expect(serialized).toContain("Unauthorized");
    expect(serialized).toContain("401");
  });

  it("is best-effort: returns null and does not throw when the DB write fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    createMock.mockRejectedValueOnce(new Error("db down"));

    const result = await writeAudit({
      contentId: "c1",
      platform: "TIKTOK",
      attempt: 3,
      outcome: "FAILURE",
    });

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});

describe("redactSecrets (Principle II)", () => {
  it("redacts secret-looking keys but preserves benign data", () => {
    const out = redactSecrets({
      token: "T",
      secret: "S",
      authorization: "A",
      author: "Jane",
      count: 42,
    }) as Record<string, unknown>;

    expect(out.token).toBe("[REDACTED]");
    expect(out.secret).toBe("[REDACTED]");
    expect(out.authorization).toBe("[REDACTED]");
    expect(out.author).toBe("Jane"); // not a false positive
    expect(out.count).toBe(42);
  });

  it("normalizes Error and Date and handles cycles", () => {
    expect(redactSecrets(new Error("boom"))).toEqual({
      name: "Error",
      message: "boom",
    });
    expect(redactSecrets(new Date("2026-01-01T00:00:00.000Z"))).toBe(
      "2026-01-01T00:00:00.000Z",
    );

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(redactSecrets(cyclic)).toEqual({ self: "[CIRCULAR]" });
  });

  it("recurses into arrays", () => {
    const out = redactSecrets([{ apiKey: "K" }, { ok: 1 }]);
    expect(out).toEqual([{ apiKey: "[REDACTED]" }, { ok: 1 }]);
  });
});
