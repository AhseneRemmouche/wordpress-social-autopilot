import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

// Control CRON_SECRET per test via a mutable mocked env; stub the tick itself.
const h = vi.hoisted(() => ({ env: { CRON_SECRET: undefined as string | undefined } }));
vi.mock("@/lib/env", () => ({ env: h.env }));
vi.mock("@/lib/queue/worker", () => ({
  runTick: vi.fn(async () => ({ generated: 2, published: 3, failed: 0 })),
}));

import { runTick } from "@/lib/queue/worker";
import { GET, POST } from "@/app/api/worker/tick/route";

const runTickMock = runTick as unknown as Mock;

function req(method: string, auth?: string): Request {
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers.authorization = auth;
  return new Request("http://localhost/api/worker/tick", { method, headers });
}

beforeEach(() => {
  h.env.CRON_SECRET = undefined;
  runTickMock.mockClear();
});

describe("/api/worker/tick — fail-closed cron runner (Principle II/VII)", () => {
  it("503 (disabled) when CRON_SECRET is not configured — never open", async () => {
    const res = await GET(req("GET"));
    expect(res.status).toBe(503);
    expect(runTickMock).not.toHaveBeenCalled();
  });

  it("401 when the bearer token is missing or wrong", async () => {
    h.env.CRON_SECRET = "s3cret";
    expect((await GET(req("GET"))).status).toBe(401);
    expect((await GET(req("GET", "Bearer nope"))).status).toBe(401);
    expect(runTickMock).not.toHaveBeenCalled();
  });

  it("200 + tick counts with the correct bearer (GET and POST)", async () => {
    h.env.CRON_SECRET = "s3cret";

    const resGet = await GET(req("GET", "Bearer s3cret"));
    expect(resGet.status).toBe(200);
    expect(await resGet.json()).toEqual({ ok: true, generated: 2, published: 3, failed: 0 });

    const resPost = await POST(req("POST", "Bearer s3cret"));
    expect(resPost.status).toBe(200);
    expect(runTickMock).toHaveBeenCalledTimes(2);
  });

  it("500 with a secret-free message when the tick throws", async () => {
    h.env.CRON_SECRET = "s3cret";
    runTickMock.mockRejectedValueOnce(new Error("db down at postgres://user:pass@host/db"));

    const res = await POST(req("POST", "Bearer s3cret"));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body).toEqual({ ok: false, error: "tick failed" });
    expect(JSON.stringify(body)).not.toContain("postgres://");
  });
});
