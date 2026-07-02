import type { GeneratedContent, PlatformAccount } from "@prisma/client";

import { getValidAccessToken, refreshAccessToken } from "@/lib/oauth/tokens";
import { composePostText } from "@/lib/publishers/compose";
import type { Publisher, PublishResult } from "@/lib/publishers/types";

/**
 * X (Twitter) publisher (research.md, FR-010).
 * POST /2/tweets with an OAuth 2.0 user-context Bearer token, JSON { text }
 * (<=280 chars, includes the shortened link via composePostText). Success is 201
 * with { data: { id } }. 429 / 5xx are retryable; 401 triggers a token refresh +
 * one retry. Error messages are secret-free.
 *
 * Note: X posting is pay-per-use (see research.md) — an account/billing concern,
 * not a code change.
 */

const TWEETS_URL = "https://api.x.com/2/tweets";

function postTweet(token: string, text: string): Promise<Response> {
  return fetch(TWEETS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
}

async function publish(
  content: GeneratedContent,
  account: PlatformAccount,
): Promise<PublishResult> {
  let token: string;
  try {
    token = await getValidAccessToken(account);
  } catch {
    return { ok: false, retryable: false, error: "X token unavailable (reconnect required)" };
  }

  const text = composePostText(content);
  let response = await postTweet(token, text);

  // Token expired mid-publish → refresh + rotate once and retry.
  if (response.status === 401) {
    try {
      token = await refreshAccessToken(account);
    } catch {
      return { ok: false, retryable: false, error: "X token expired; reconnect required" };
    }
    response = await postTweet(token, text);
  }

  if (response.status === 201) {
    const json = (await response.json()) as { data?: { id?: string } };
    return { ok: true, externalId: json.data?.id };
  }

  const retryable = response.status === 429 || response.status >= 500;
  return { ok: false, retryable, error: `X publish failed (HTTP ${response.status})` };
}

export const xPublisher: Publisher = {
  platform: "X",
  capabilities: { autoPublish: true, requiresMedia: false },
  publish,
};
