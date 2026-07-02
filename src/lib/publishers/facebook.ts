import type { GeneratedContent, PlatformAccount } from "@prisma/client";

import { getValidAccessToken } from "@/lib/oauth/tokens";
import { composePostText } from "@/lib/publishers/compose";
import type { Publisher, PublishResult } from "@/lib/publishers/types";

/**
 * Facebook Page publisher (research.md, FR-010).
 * POST /{page-id}/feed with a Page access token, `message` + a clickable `link`.
 * Success returns { id }. 429 / 5xx are retryable; 401 requires a reconnect.
 * Error messages are secret-free.
 */

const GRAPH = "https://graph.facebook.com/v25.0";

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
  const res = await fetch(`${GRAPH}/${pageId}/feed`, {
    method: "POST",
    body: new URLSearchParams({ message, link: content.link, access_token: token }),
  });

  if (res.ok) {
    const json = (await res.json()) as { id?: string };
    return { ok: true, externalId: json.id };
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
