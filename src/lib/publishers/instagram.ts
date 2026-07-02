import type { GeneratedContent, PlatformAccount } from "@prisma/client";

import { getValidAccessToken } from "@/lib/oauth/tokens";
import { prisma } from "@/lib/prisma";
import { composePostText } from "@/lib/publishers/compose";
import type { Publisher, PublishResult } from "@/lib/publishers/types";

/**
 * Instagram publisher — Graph API two-step container flow (research.md, FR-017).
 *   1. POST /{ig-user-id}/media        (image_url + caption) -> creation_id
 *   2. POST /{ig-user-id}/media_publish (creation_id)        -> media_id
 *
 * Requires a featured image (the WP post's `featuredImageUrl`, which lives on the
 * post, not GeneratedContent). With none, we return a non-retryable result the
 * worker maps to MANUAL_REQUIRED. Respects the 25-posts/24h publishing limit.
 * Error messages are secret-free.
 */

const GRAPH = "https://graph.facebook.com/v25.0";
const DAILY_LIMIT = 25;

/** The WP featured image lives on the post; fetch it by the content's postId. */
async function getFeaturedImageUrl(postId: string): Promise<string | null> {
  const post = await prisma.wordPressPost.findUnique({
    where: { id: postId },
    select: { featuredImageUrl: true },
  });
  return post?.featuredImageUrl ?? null;
}

/** Check the 25-posts/24h quota via content_publishing_limit; fail open if unreadable. */
async function quotaReached(igUserId: string, token: string): Promise<boolean> {
  const url =
    `${GRAPH}/${igUserId}/content_publishing_limit` +
    `?fields=quota_usage&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) return false;
  const json = (await res.json()) as { data?: Array<{ quota_usage?: number }> };
  const usage = json.data?.[0]?.quota_usage ?? 0;
  return usage >= DAILY_LIMIT;
}

/** Map a non-OK Graph API response to a PublishResult. */
function failure(status: number, stage: string): PublishResult {
  if (status === 401) {
    return {
      ok: false,
      retryable: false,
      error: `Instagram ${stage} unauthorized; reconnect required`,
    };
  }
  const retryable = status === 429 || status >= 500;
  return { ok: false, retryable, error: `Instagram ${stage} failed (HTTP ${status})` };
}

async function publish(
  content: GeneratedContent,
  account: PlatformAccount,
): Promise<PublishResult> {
  const igUserId = account.igUserId;
  if (!igUserId) {
    return { ok: false, retryable: false, error: "Instagram account is missing the IG user id" };
  }

  const imageUrl = await getFeaturedImageUrl(content.postId);
  if (!imageUrl) {
    // No media → the worker maps this to MANUAL_REQUIRED (FR-017).
    return {
      ok: false,
      retryable: false,
      error: "Instagram requires a featured image (none available)",
    };
  }

  let token: string;
  try {
    token = await getValidAccessToken(account);
  } catch {
    return { ok: false, retryable: false, error: "Instagram token unavailable (reconnect required)" };
  }

  if (await quotaReached(igUserId, token)) {
    return { ok: false, retryable: false, error: "Instagram 25-post/24h publishing limit reached" };
  }

  const caption = composePostText(content);

  // Step 1 — create the media container.
  const createRes = await fetch(`${GRAPH}/${igUserId}/media`, {
    method: "POST",
    body: new URLSearchParams({ image_url: imageUrl, caption, access_token: token }),
  });
  if (!createRes.ok) {
    return failure(createRes.status, "media container");
  }
  const createJson = (await createRes.json()) as { id?: string };
  const creationId = createJson.id;
  if (!creationId) {
    return { ok: false, retryable: false, error: "Instagram media container returned no id" };
  }

  // Step 2 — publish the container.
  const publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: creationId, access_token: token }),
  });
  if (!publishRes.ok) {
    return failure(publishRes.status, "media publish");
  }
  const publishJson = (await publishRes.json()) as { id?: string };
  return { ok: true, externalId: publishJson.id };
}

export const instagramPublisher: Publisher = {
  platform: "INSTAGRAM",
  capabilities: { autoPublish: true, requiresMedia: true },
  publish,
};
