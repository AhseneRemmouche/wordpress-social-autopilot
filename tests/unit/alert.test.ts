import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mutable mocked env so each test controls whether the webhook is configured.
const h = vi.hoisted(() => ({ env: { ALERT_WEBHOOK_URL: undefined as string | undefined } }));
vi.mock("@/lib/env", () => ({ env: h.env }));

import { sendAlert } from "@/lib/alert";

let fetchMock: Mock;

beforeEach(() => {
  h.env.ALERT_WEBHOOK_URL = undefined;
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendAlert", () => {
  it("is a no-op when ALERT_WEBHOOK_URL is unset (fail-open)", async () => {
    await sendAlert("hello");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs { text } to the configured webhook", async () => {
    h.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/abc";
    await sendAlert("boom");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/abc");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ text: "boom" });
  });

  it("never throws when the webhook request fails", async () => {
    h.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/abc";
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(sendAlert("x")).resolves.toBeUndefined();
  });
});
