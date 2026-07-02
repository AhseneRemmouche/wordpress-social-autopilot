import type { GeneratedContent, PlatformAccount } from "@prisma/client";

import { getValidAccessToken, refreshAccessToken } from "@/lib/oauth/tokens";
import { prisma } from "@/lib/prisma";
import { composePostText } from "@/lib/publishers/compose";
import type { Publisher, PublishResult } from "@/lib/publishers/types";

/**
 * TikTok publisher — Content Posting API v2, photo inbox/draft flow (research.md,
 * FR-010). POST /v2/post/publish/content/init/ with post_mode MEDIA_UPLOAD +
 * media_type PHOTO + source PULL_FROM_URL (the WP featured image). This queues a
 * draft to the creator's TikTok inbox to finalize in-app — which works for
 * unaudited apps (content is private-only until the client is audited).
 *
 * Requires a featured image (from the WP post, not GeneratedContent). None →
 * non-retryable → worker maps to MANUAL_REQUIRED. Rotating-refresh on token
 * expiry. Note: TikTok returns `error.code` in the JSON body even on HTTP 200,
 * so success requires code === "ok". Error messages are secret-free.
 */

const INIT_URL = "https://open.tiktokapis.com/v2/post/publish/content/init/";

interface TikTokResponse {
  data?: { publish_id?: string };
  error?: { code?: string };
}

interface InitResult {
  status: number;
  body: TikTokResponse | null;
}

/** The WP featured image lives on the post; fetch it by the content's postId. */
async function getFeaturedImageUrl(postId: string): Promise<string | null> {
  const post = await prisma.wordPressPost.findUnique({
    where: { id: postId },
    select: { featuredImageUrl: true },
  });
  return post?.featuredImageUrl ?? null;
}

/** A TikTok error is auth-related if the HTTP status is 401 or the code says so. */
function isTokenError(status: number, code: string | undefined): boolean {
  return status === 401 || code === "access_token_invalid";
}

function initPhotoDraft(
  token: string,
  content: GeneratedContent,
  imageUrl: string,
): Promise<InitResult> {
  const title = (content.body.split("\n")[0]?.trim() ?? "").slice(0, 90);
  const requestBody = {
    media_type: "PHOTO",
    post_mode: "MEDIA_UPLOAD",
    post_info: {
      title: title.length > 0 ? title : "New post",
      description: composePostText(content),
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_cover_index: 0,
      photo_images: [imageUrl],
    },
  };

  return fetch(INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(requestBody),
  }).then(async (res) => {
    let body: TikTokResponse | null = null;
    try {
      body = (await res.json()) as TikTokResponse;
    } catch {
      body = null;
    }
    return { status: res.status, body };
  });
}

async function publish(
  content: GeneratedContent,
  account: PlatformAccount,
): Promise<PublishResult> {
  const imageUrl = await getFeaturedImageUrl(content.postId);
  if (!imageUrl) {
    // No media → the worker maps this to MANUAL_REQUIRED (FR-017).
    return {
      ok: false,
      retryable: false,
      error: "TikTok requires a featured image (none available)",
    };
  }

  let token: string;
  try {
    token = await getValidAccessToken(account);
  } catch {
    return { ok: false, retryable: false, error: "TikTok token unavailable (reconnect required)" };
  }

  let result = await initPhotoDraft(token, content, imageUrl);

  // Token expired mid-publish → refresh + rotate once and retry.
  if (isTokenError(result.status, result.body?.error?.code)) {
    try {
      token = await refreshAccessToken(account);
    } catch {
      return { ok: false, retryable: false, error: "TikTok token expired; reconnect required" };
    }
    result = await initPhotoDraft(token, content, imageUrl);
  }

  const code = result.body?.error?.code;
  if (result.status >= 200 && result.status < 300 && code === "ok") {
    return { ok: true, externalId: result.body?.data?.publish_id };
  }

  if (isTokenError(result.status, code)) {
    return { ok: false, retryable: false, error: "TikTok unauthorized; reconnect required" };
  }

  const rateLimited =
    result.status === 429 ||
    code === "rate_limit_exceeded" ||
    code === "spam_risk_too_many_posts";
  const retryable = rateLimited || result.status >= 500;
  return {
    ok: false,
    retryable,
    error: `TikTok publish failed (HTTP ${result.status}${code ? `; ${code}` : ""})`,
  };
}

export const tiktokPublisher: Publisher = {
  platform: "TIKTOK",
  capabilities: { autoPublish: true, requiresMedia: true },
  publish,
};
