import type { GeneratedContent, PlatformAccount } from "@prisma/client";

import { getValidAccessToken, refreshAccessToken } from "@/lib/oauth/tokens";
import { composePostText } from "@/lib/publishers/compose";
import type { Publisher, PublishResult } from "@/lib/publishers/types";

/**
 * LinkedIn publisher (research.md, FR-010, Principle III).
 * POST /rest/posts with an article-content post. Success is 201 with the post id
 * in the `x-restli-id` header. 429 / 5xx are retryable; 401 triggers a token
 * refresh + one retry. Error messages are secret-free.
 */

const POSTS_URL = "https://api.linkedin.com/rest/posts";
const LINKEDIN_VERSION = "202606";
const RESTLI_VERSION = "2.0.0";

/** Derive a link-preview title from the generated body (WP title isn't in GeneratedContent). */
function articleTitle(body: string): string {
  const firstLine = body.split("\n")[0]?.trim() ?? "";
  return (firstLine.length > 0 ? firstLine : "Read the full article").slice(0, 200);
}

function postToLinkedIn(
  token: string,
  author: string,
  content: GeneratedContent,
): Promise<Response> {
  const requestBody = {
    author,
    commentary: composePostText(content),
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    content: {
      article: {
        source: content.link,
        title: articleTitle(content.body),
        description: content.body.replace(/\s+/g, " ").trim().slice(0, 256),
      },
    },
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

  let response = await postToLinkedIn(token, author, content);

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
    response = await postToLinkedIn(token, author, content);
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
