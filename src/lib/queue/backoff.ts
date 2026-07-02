/**
 * Exponential backoff with full jitter for the publish queue (FR-028, plan §8).
 *
 * The retry delay for attempt `n` (1-based: the delay scheduled *after* the
 * n-th failed attempt) is a uniformly-random value in `[0, base * 2^n]`,
 * capped so a saturated queue never schedules absurdly far out. Full jitter
 * (AWS "Exponential Backoff And Jitter") spreads retries to avoid thundering
 * herds while preserving exponential growth of the ceiling.
 */

/** Base unit of delay (ms) — the ceiling for the first retry is `2 * BASE_MS`. */
export const BASE_MS = 1_000;

/** Hard cap on any single backoff delay (15 minutes). */
export const MAX_MS = 15 * 60 * 1_000;

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  /** Injectable RNG for deterministic tests; defaults to Math.random. */
  random?: () => number;
}

/**
 * Compute the backoff delay in ms for a given (1-based) attempt number.
 * Returns an integer in `[0, min(base * 2^attempt, max)]`.
 */
export function backoffMs(attempt: number, opts: BackoffOptions = {}): number {
  const base = opts.baseMs ?? BASE_MS;
  const max = opts.maxMs ?? MAX_MS;
  const rand = opts.random ?? Math.random;

  const safeAttempt = Math.max(0, Math.floor(attempt));
  // Cap the exponent so 2^attempt cannot overflow before the min() clamps it.
  const ceiling = Math.min(base * 2 ** Math.min(safeAttempt, 30), max);
  return Math.floor(rand() * ceiling);
}

/**
 * Convenience: the next run time for a retry after `attempt` failures,
 * relative to `from` (defaults to now).
 */
export function nextRunAt(
  attempt: number,
  opts: BackoffOptions = {},
  from: number = Date.now(),
): Date {
  return new Date(from + backoffMs(attempt, opts));
}
