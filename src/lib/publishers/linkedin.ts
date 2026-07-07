import type { GeneratedContent, PlatformAccount } from "@prisma/client";

import { getValidAccessToken, refreshAccessToken } from "@/lib/oauth/tokens";
import { prisma } from "@/lib/prisma";
import { composePostText } from "@/lib/publishers/compose";
import type { Publisher, PublishResult } from "@/lib/publishers/types";

/**
 * LinkedIn publisher (research.md, FR-010, Principle III).
 * POST /rest/posts. When the WordPress post has a featured image, the image is
 * uploaded via the Images API and the post carries it as native media (so the
 * article picture shows, instead of relying on LinkedIn scraping the article's
 * og:image — which fails when the site sits behind a bot-blocking CDN). With no
 * featured image (or if any upload step fails) we fall back to an article/link
 * post. Success is 201 with the post id in the `x-restli-id` header. 429 / 5xx
 * are retryable; 401 triggers a token refresh + one retry. Errors are secret-free.
 */

const POSTS_URL = "https://api.linkedin.com/rest/posts";
const IMAGES_URL = "https://api.linkedin.com/rest/images";
const LINKEDIN_VERSION = "202606";
const RESTLI_VERSION = "2.0.0";

/** Derive a link-preview / alt-text title from the generated body (WP title isn't in GeneratedContent). */
function articleTitle(body: string): string {
  const firstLine = body.split("\n")[0]?.trim() ?? "";
  return (firstLine.length > 0 ? firstLine : "Read the full article").slice(0, 200);
}

/** The WP featured image lives on the post; fetch it by the content's postId. */
async function getFeaturedImageUrl(postId: string): Promise<string | null> {
  const post = await prisma.wordPressPost.findUnique({
    where: { id: postId },
    select: { featuredImageUrl: true },
  });
  return post?.featuredImageUrl ?? null;
}

/**
 * Upload the featured image to LinkedIn and return its image URN, or null if any
 * step fails (the caller then posts an article/link instead — an image is never
 * worth failing the whole publish over). Three steps: register the upload, PUT
 * the image bytes to the returned URL, then reference the URN in the post.
 */
async function uploadImage(
  token: string,
  owner: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    // 1. Register the upload — returns a one-time uploadUrl and the image URN.
    const initRes = await fetch(`${IMAGES_URL}?action=initializeUpload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": LINKEDIN_VERSION,
        "X-Restli-Protocol-Version": RESTLI_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ initializeUploadRequest: { owner } }),
    });
    if (!initRes.ok) return null;
    const init = (await initRes.json()) as {
      value?: { uploadUrl?: string; image?: string };
    };
    const uploadUrl = init.value?.uploadUrl;
    const imageUrn = init.value?.image;
    if (!uploadUrl || !imageUrn) return null;

    // 2. Fetch the image bytes from WordPress and PUT them to LinkedIn.
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const bytes = await imgRes.arrayBuffer();
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": imgRes.headers.get("content-type") ?? "application/octet-stream",
      },
      body: bytes,
    });
    if (!putRes.ok) return null;

    return imageUrn;
  } catch {
    return null; // network/parse error → fall back to an article post
  }
}

function postToLinkedIn(
  token: string,
  author: string,
  content: GeneratedContent,
  imageUrn: string | null,
): Promise<Response> {
  // Image post when the featured image uploaded; otherwise an article/link post.
  const postContent = imageUrn
    ? { media: { id: imageUrn, altText: articleTitle(content.body) } }
    : {
        article: {
          source: content.link,
          title: articleTitle(content.body),
          description: content.body.replace(/\s+/g, " ").trim().slice(0, 256),
        },
      };

  const requestBody = {
    author,
    commentary: composePostText(content),
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    content: postContent,
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  return fetch(POSTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": RESTLI_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
}

async function publish(
  content: GeneratedContent,
  account: PlatformAccount,
): Promise<PublishResult> {
  const author = account.externalAccountId;
  if (!author) {
    return { ok: false, retryable: false, error: "LinkedIn account is missing an author URN" };
  }

  let token: string;
  try {
    token = await getValidAccessToken(account);
  } catch {
    return { ok: false, retryable: false, error: "LinkedIn token unavailable (reconnect required)" };
  }

  // Best-effort: attach the featured image as native media; null → article post.
  const imageUrl = await getFeaturedImageUrl(content.postId);
  const imageUrn = imageUrl ? await uploadImage(token, author, imageUrl) : null;

  let response = await postToLinkedIn(token, author, content, imageUrn);

  // Token expired mid-publish → refresh once and retry.
  if (response.status === 401) {
    try {
      token = await refreshAccessToken(account);
    } catch {
      return {
        ok: false,
        retryable: false,
        error: "LinkedIn token expired; reconnect required",
      };
    }
    response = await postToLinkedIn(token, author, content, imageUrn);
  }

  if (response.status === 201) {
    return { ok: true, externalId: response.headers.get("x-restli-id") ?? undefined };
  }

  const retryable = response.status === 429 || response.status >= 500;
  return { ok: false, retryable, error: `LinkedIn publish failed (HTTP ${response.status})` };
}

export const linkedinPublisher: Publisher = {
  platform: "LINKEDIN",
  capabilities: { autoPublish: true, requiresMedia: false },
  publish,
};
