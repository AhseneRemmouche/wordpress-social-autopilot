import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";

/**
 * Claude client for content generation (Constitution Principle IV).
 *
 * Model: Claude Opus 4.8 — the most capable model, per the constitution's
 * "latest and most capable" guidance for marketing/social copy.
 *
 * Generation uses adaptive thinking (`{ type: "adaptive" }`). `budget_tokens` is
 * removed on Opus 4.8 and returns a 400 — never use it. Structured per-platform
 * output is enforced via `client.messages.parse` + `zodOutputFormat` (PROMPT 51).
 */

export const MODEL = "claude-opus-4-8";

/** Standardized thinking config — adaptive only (never a token budget). */
export const THINKING = { type: "adaptive" } as const;

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
