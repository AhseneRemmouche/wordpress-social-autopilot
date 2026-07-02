import type { Platform } from "@prisma/client";

import { facebookPublisher } from "@/lib/publishers/facebook";
import { instagramPublisher } from "@/lib/publishers/instagram";
import { linkedinPublisher } from "@/lib/publishers/linkedin";
import { tiktokPublisher } from "@/lib/publishers/tiktok";
import type { Publisher } from "@/lib/publishers/types";
import { xPublisher } from "@/lib/publishers/x";
import { youtubePublisher } from "@/lib/publishers/youtube";

/**
 * Registry of every platform's isolated publisher module (Principle III). Keyed
 * by the Prisma `Platform` type so TypeScript enforces full coverage. Used by the
 * queue worker to resolve the publisher for a job.
 */
export const PUBLISHERS: Record<Platform, Publisher> = {
  LINKEDIN: linkedinPublisher,
  INSTAGRAM: instagramPublisher,
  FACEBOOK: facebookPublisher,
  YOUTUBE: youtubePublisher,
  X: xPublisher,
  TIKTOK: tiktokPublisher,
};

export function getPublisher(platform: Platform): Publisher {
  return PUBLISHERS[platform];
}

export type { Publisher, PublishResult } from "@/lib/publishers/types";
