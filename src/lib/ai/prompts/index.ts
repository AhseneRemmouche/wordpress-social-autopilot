import type { Platform } from "@prisma/client";

import { facebookPrompt } from "@/lib/ai/prompts/facebook";
import { instagramPrompt } from "@/lib/ai/prompts/instagram";
import { linkedinPrompt } from "@/lib/ai/prompts/linkedin";
import { tiktokPrompt } from "@/lib/ai/prompts/tiktok";
import type { PlatformPrompt } from "@/lib/ai/prompts/types";
import { xPrompt } from "@/lib/ai/prompts/x";
import { youtubePrompt } from "@/lib/ai/prompts/youtube";

/**
 * Registry of every platform's version-controlled prompt (Principle IV).
 * Keyed by the Prisma `Platform` type, so TypeScript enforces full coverage —
 * adding a platform won't compile until its prompt is registered here.
 */
export const PLATFORM_PROMPTS: Record<Platform, PlatformPrompt> = {
  LINKEDIN: linkedinPrompt,
  INSTAGRAM: instagramPrompt,
  FACEBOOK: facebookPrompt,
  YOUTUBE: youtubePrompt,
  X: xPrompt,
  TIKTOK: tiktokPrompt,
};

export function getPrompt(platform: Platform): PlatformPrompt {
  return PLATFORM_PROMPTS[platform];
}

export type { PlatformPrompt, PostInput } from "@/lib/ai/prompts/types";
