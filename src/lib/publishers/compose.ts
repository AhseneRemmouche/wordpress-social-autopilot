import type { GeneratedContent } from "@prisma/client";

import { truncateToLimit } from "@/lib/limits";

/**
 * Compose the final post text for a platform: the generated body plus its
 * hashtags (which the prompts intentionally return separately), guaranteed
 * within the platform's character limit with the backlink preserved
 * (FR-009/FR-010/FR-011). `truncateToLimit` de-duplicates the link, so calling
 * this on a body that already contains the link is safe.
 */
export function composePostText(
  content: Pick<GeneratedContent, "body" | "hashtags" | "link" | "platform">,
): string {
  const text =
    content.hashtags.length > 0
      ? `${content.body}\n\n${content.hashtags.join(" ")}`
      : content.body;
  return truncateToLimit(text, content.link, content.platform);
}
