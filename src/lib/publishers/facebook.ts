import type { GeneratedContent, PlatformAccount } from "@prisma/client";

import { getValidAccessToken } from "@/lib/oauth/tokens";
import { prisma } from "@/lib/prisma";
import { composePostText } from "@/lib/publishers/compose";
import type { Publisher, PublishResult } from "@/lib/publishers/types";

/**
 * Facebook Page publisher (research.md, FR-010).
 *
 * When the WordPress post has a featured image, publish a PHOTO post
 * (POST /{page-id}/photos with `url` + `caption`) so the post shows the
 * article's own image. Facebook link posts otherwise pull the preview from the
 * page's og:image (often a generic site logo), so photo posts give a far better
 * visual. With no featured image, fall back to a link post (POST /{page-id}/feed
 * with `message` + a clickable `link`). The composed caption/message already
 * contains the backlink (composePostText), so the article stays one tap away.
 *
 * Success returns the feed post id. 429 / 5xx are retryable; 401 requires a
 * reconnect. Error messages are secret-free.
 */

const GRAPH = "https://graph.facebook.com/v25.0";

/** The WP featured image lives on the post; fetch it by the content's postId. */
async function getFeaturedImageUrl(postId: string): Promise<string | null> {
  const post = await prisma.wordPressPost.findUnique({
    where: { id: postId },
    select: { featuredImageUrl: true },
  });
  return post?.featuredImageUrl ?? null;
}

async function publish(
  content: GeneratedContent,
  account: PlatformAccount,
): Promise<PublishResult> {
  const pageId = account.fbPageId;
  if (!pageId) {
    return { ok: false, retryable: false, error: "Facebook account is missing the Page id" };
  }

  let token: string;
  try {
    token = await getValidAccessToken(account);
  } catch {
    return { ok: false, retryable: false, error: "Facebook token unavailable (reconnect required)" };
  }

  const message = composePostText(content);
  const imageUrl = await getFeaturedImageUrl(content.postId);

  // Photo post when there's a featured image (shows the article image); the
  // caption carries the backlink. Otherwise a plain link post.
  const res = imageUrl
    ? await fetch(`${GRAPH}/${pageId}/photos`, {
        method: "POST",
        body: new URLSearchParams({ url: imageUrl, caption: message, access_token: token }),
      })
    : await fetch(`${GRAPH}/${pageId}/feed`, {
        method: "POST",
        body: new URLSearchParams({ message, link: content.link, access_token: token }),
      });

  if (res.ok) {
    // /photos returns { id (photo id), post_id (feed post) }; /feed returns { id }.
    const json = (await res.json()) as { id?: string; post_id?: string };
    return { ok: true, externalId: json.post_id ?? json.id };
  }

  if (res.status === 401) {
    return { ok: false, retryable: false, error: "Facebook unauthorized; reconnect required" };
  }
  const retryable = res.status === 429 || res.status >= 500;
  return { ok: false, retryable, error: `Facebook publish failed (HTTP ${res.status})` };
}

export const facebookPublisher: Publisher = {
  platform: "FACEBOOK",
  capabilities: { autoPublish: true, requiresMedia: false },
  publish,
};
