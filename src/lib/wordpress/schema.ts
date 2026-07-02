import { z } from "zod";

/**
 * WordPress webhook payload validation (Constitution Principle I — Zod at the
 * boundary). FR-004, contracts/webhook.md.
 */

/** Fields required to generate content; if any are missing we backfill (FR-005). */
export const GENERATION_REQUIRED_FIELDS = ["title", "content", "url"] as const;
export type GenerationRequiredField = (typeof GENERATION_REQUIRED_FIELDS)[number];

/**
 * Inbound webhook payload — intentionally lenient. WordPress may send a partial
 * payload; only `wpPostId` is strictly required (to identify the post for
 * backfill). Content fields are optional and validated for completeness
 * separately via {@link getMissingGenerationFields} / {@link completePostSchema}.
 */
export const webhookPayloadSchema = z.object({
  wpPostId: z.string().min(1),
  event: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  excerpt: z.string().optional(),
  featuredImageUrl: z.string().nullable().optional(),
  url: z.string().optional(),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

/**
 * A post with everything required to generate content — after any NovaMira
 * backfill. `url` must be a valid URL (the mandatory backlink, FR-009); title
 * and content must be non-empty. `featuredImageUrl` stays optional (only
 * IG/TikTok need it).
 */
export const completePostSchema = z.object({
  wpPostId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  excerpt: z.string().default(""),
  featuredImageUrl: z.string().nullable().default(null),
  url: z.url(),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export type CompletePost = z.infer<typeof completePostSchema>;

/** The generation-required fields that are missing or empty in `payload`. */
export function getMissingGenerationFields(
  payload: Partial<Record<GenerationRequiredField, string | null | undefined>>,
): GenerationRequiredField[] {
  return GENERATION_REQUIRED_FIELDS.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || value.trim().length === 0;
  });
}

/** True when the payload has every field needed to generate content. */
export function isCompleteForGeneration(
  payload: Partial<Record<GenerationRequiredField, string | null | undefined>>,
): boolean {
  return getMissingGenerationFields(payload).length === 0;
}
