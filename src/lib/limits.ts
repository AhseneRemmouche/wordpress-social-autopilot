import type { Platform } from "@prisma/client";

/**
 * Per-platform character limits (FR-010). Keyed by the Prisma `Platform` type so
 * TypeScript enforces that every platform has a limit. Facebook uses the 500-char
 * engagement *target* (its hard limit is far higher) per the spec.
 */
export const PLATFORM_CHAR_LIMITS: Record<Platform, number> = {
  LINKEDIN: 3000,
  INSTAGRAM: 2200,
  FACEBOOK: 500,
  YOUTUBE: 5000,
  X: 280,
  TIKTOK: 2200,
};

/** Separator placed between the body and the appended post link. */
const LINK_SEPARATOR = "\n\n";

export function getCharLimit(platform: Platform): number {
  return PLATFORM_CHAR_LIMITS[platform];
}

/** Truncate `text` to at most `max` chars, cutting back to the last word boundary. */
function truncateAtWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastWhitespace = Math.max(
    slice.lastIndexOf(" "),
    slice.lastIndexOf("\n"),
    slice.lastIndexOf("\t"),
  );
  const cut = lastWhitespace > 0 ? slice.slice(0, lastWhitespace) : slice;
  return cut.trimEnd();
}

/**
 * Guarantee that platform content fits within its character limit while ALWAYS
 * preserving the post link (FR-011, clarification: hard-truncate — never
 * regenerate). The link is appended at the end and is never truncated; the body
 * is hard-truncated at a word boundary to make room.
 *
 * Any existing copies of the link in `text` are removed first so the link is not
 * duplicated when the generator has already appended it.
 */
export function truncateToLimit(
  text: string,
  link: string,
  platform: Platform,
): string {
  const limit = getCharLimit(platform);

  // Remove any existing occurrences of the link; we re-append exactly one.
  const bodyOnly = (link ? text.split(link).join("") : text).trimEnd();

  const reserved = link.length + LINK_SEPARATOR.length;
  if (reserved >= limit) {
    // Pathological: the link (plus separator) alone fills the limit.
    return link.length <= limit ? link : link.slice(0, limit);
  }

  const available = limit - reserved;
  const truncatedBody = truncateAtWordBoundary(bodyOnly, available);

  return truncatedBody.length > 0
    ? `${truncatedBody}${LINK_SEPARATOR}${link}`
    : link;
}
