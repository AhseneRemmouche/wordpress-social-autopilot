import { describe, expect, it } from "vitest";

import { BASE_MS, MAX_MS, backoffMs, nextRunAt } from "@/lib/queue/backoff";

describe("backoffMs (FR-028 — exponential backoff + full jitter)", () => {
  it("stays within [0, base * 2^attempt] for early attempts", () => {
    for (const attempt of [1, 2, 3, 4, 5]) {
      const ceiling = BASE_MS * 2 ** attempt;
      for (let i = 0; i < 200; i++) {
        const delay = backoffMs(attempt);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(ceiling);
      }
    }
  });

  it("has a growing ceiling — later attempts can produce larger delays", () => {
    // With random() pinned to its max, each attempt returns its ceiling.
    const at = (attempt: number) =>
      backoffMs(attempt, { random: () => 0.999999 });
    expect(at(2)).toBeGreaterThan(at(1));
    expect(at(3)).toBeGreaterThan(at(2));
  });

  it("full-jitter floor is 0 (random() = 0 → no delay)", () => {
    expect(backoffMs(5, { random: () => 0 })).toBe(0);
  });

  it("never exceeds the max cap even for large attempts", () => {
    for (const attempt of [10, 20, 50, 100]) {
      const delay = backoffMs(attempt, { random: () => 0.999999 });
      expect(delay).toBeLessThanOrEqual(MAX_MS);
    }
  });

  it("honours injected base/max bounds", () => {
    // ceiling = min(100 * 2^3, 300) = 300; random 0.5 → 150.
    expect(backoffMs(3, { baseMs: 100, maxMs: 300, random: () => 0.5 })).toBe(150);
  });

  it("treats non-positive attempts as attempt 0 (ceiling = base)", () => {
    expect(backoffMs(0, { random: () => 0.999999 })).toBeLessThanOrEqual(BASE_MS);
    expect(backoffMs(-3, { random: () => 0.999999 })).toBeLessThanOrEqual(BASE_MS);
  });
});

describe("nextRunAt", () => {
  it("returns a Date offset from the given base time by the backoff delay", () => {
    const from = 1_000_000;
    const at = nextRunAt(3, { baseMs: 100, maxMs: 10_000, random: () => 0.5 }, from);
    // ceiling = 100 * 2^3 = 800; 0.5 → 400.
    expect(at.getTime()).toBe(from + 400);
  });

  it("is always in the future or now (delay >= 0)", () => {
    const from = 5_000;
    expect(nextRunAt(4, { random: () => 0 }, from).getTime()).toBe(from);
  });
});
