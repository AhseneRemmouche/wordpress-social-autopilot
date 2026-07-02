import { describe, expect, it } from "vitest";

import { MODEL, THINKING, anthropic } from "@/lib/ai/client";

describe("ai/client (Principle IV)", () => {
  it("exports the Opus 4.8 model id", () => {
    expect(MODEL).toBe("claude-opus-4-8");
  });

  it("standardizes on adaptive thinking (never budget_tokens)", () => {
    expect(THINKING).toEqual({ type: "adaptive" });
  });

  it("constructs the Anthropic client with the (test) API key", () => {
    // Importing the module already ran `new Anthropic({ apiKey })` against the
    // seeded test env; assert the client is usable.
    expect(anthropic).toBeDefined();
    expect(anthropic.messages).toBeDefined();
  });
});
