import type { Platform } from "@prisma/client";

/**
 * Build a public URL to a live published post from the platform's returned id
 * (`AuditLog.externalId`, saved on a successful publish). Facebook, LinkedIn and
 * X have deterministic post URLs; the others don't (TikTok uploads a private
 * inbox draft, YouTube is manual, and Instagram's permalink isn't stored yet),
 * so they return null and the card shows no link.
 */
export function buildPostUrl(
  platform: Platform,
  externalId: string | null | undefined,
): string | null {
  const id = externalId?.trim();
  if (!id) return null;

  switch (platform) {
    case "FACEBOOK":
      // id is "{pageId}_{postId}"; this URL resolves to the post.
      return `https://www.facebook.com/${id}`;
    case "LINKEDIN":
      // id is the share/ugcPost URN, e.g. urn:li:share:123.
      return `https://www.linkedin.com/feed/update/${id}`;
    case "X":
      // id is the tweet id; /i/web/status resolves without the handle.
      return `https://x.com/i/web/status/${id}`;
    default:
      return null;
  }
}

/**
 * The platform's create-a-post page — where the operator goes to publish a manual
 * card (YouTube, TikTok) after copying the caption. Static per platform; other
 * platforms auto-publish and don't need it (returns null).
 */
export function publishHubUrl(platform: Platform): string | null {
  switch (platform) {
    case "YOUTUBE":
      return "https://studio.youtube.com"; // → Create → Create post / Upload videos
    case "TIKTOK":
      return "https://www.tiktok.com/tiktokstudio/upload"; // web upload
    default:
      return null;
  }
}
