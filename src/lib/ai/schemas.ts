import type { Platform } from "@prisma/client";
import { z } from "zod";

/**
 * Zod schemas for Claude's structured per-platform output (Principle IV — every
 * Claude response is validated). Shape is `{ body, hashtags[] }`; hashtag-count
 * bounds follow FR-010. These feed `zodOutputFormat` + `messages.parse`.
 *
 * Note: the Anthropic SDK removes array-length constraints from the JSON Schema
 * sent to the model and re-validates them client-side in `messages.parse`, so a
 * response with the wrong hashtag count fails validation (and that platform's
 * generation is marked FAILED).
 */

function outputSchema(minHashtags: number, maxHashtags: number) {
  return z.object({
    body: z.string().min(1),
    hashtags: z.array(z.string()).min(minHashtags).max(maxHashtags),
  });
}

export const PLATFORM_OUTPUT_SCHEMAS = {
  LINKEDIN: outputSchema(3, 5),
  INSTAGRAM: outputSchema(10, 15),
  FACEBOOK: outputSchema(2, 3),
  // YouTube hashtags are flexible — no strict count bound.
  YOUTUBE: z.object({
    body: z.string().min(1),
    hashtags: z.array(z.string()),
  }),
  X: outputSchema(1, 2),
  TIKTOK: outputSchema(3, 5),
} satisfies Record<Platform, z.ZodType>;

/** The validated shape of a generated content item. */
export type GeneratedOutput = z.infer<typeof PLATFORM_OUTPUT_SCHEMAS.LINKEDIN>;

export function getOutputSchema(
  platform: Platform,
): (typeof PLATFORM_OUTPUT_SCHEMAS)[Platform] {
  return PLATFORM_OUTPUT_SCHEMAS[platform];
}
