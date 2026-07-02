import type { Platform } from "@prisma/client";

/**
 * URL-slug ⇄ Platform mapping for the OAuth routes (`/api/oauth/[platform]/…`).
 * Slugs are the lowercase public names; the Prisma enum is uppercase.
 */

export const PLATFORM_SLUGS = {
  linkedin: "LINKEDIN",
  facebook: "FACEBOOK",
  instagram: "INSTAGRAM",
  x: "X",
  tiktok: "TIKTOK",
  youtube: "YOUTUBE",
} as const satisfies Record<string, Platform>;

export type PlatformSlug = keyof typeof PLATFORM_SLUGS;

const SLUG_BY_PLATFORM = Object.fromEntries(
  Object.entries(PLATFORM_SLUGS).map(([slug, platform]) => [platform, slug]),
) as Record<Platform, PlatformSlug>;

/** Parse a route slug into a Platform, or null if it is not a known platform. */
export function parsePlatformSlug(slug: string): Platform | null {
  return (PLATFORM_SLUGS as Record<string, Platform>)[slug.toLowerCase()] ?? null;
}

/** The lowercase route slug for a Platform. */
export function platformSlug(platform: Platform): PlatformSlug {
  return SLUG_BY_PLATFORM[platform];
}
