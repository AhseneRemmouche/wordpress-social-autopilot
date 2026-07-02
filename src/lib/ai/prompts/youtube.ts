import {
  type PlatformPrompt,
  type PostInput,
  renderArticleContext,
} from "@/lib/ai/prompts/types";

/**
 * YouTube content prompt (FR-008/FR-010, Principle IV — a named constant).
 * Community post / video description · ≤5000 chars · timestamps where relevant ·
 * include the post link · specific to the article.
 *
 * NOTE: The public YouTube Data API has no endpoint to create community posts
 * (research.md), so this copy is held as MANUAL_REQUIRED for the owner to post
 * manually (or attach as a video description).
 */

const SYSTEM = `You are an expert YouTube copywriter who writes community posts and video descriptions that drive views and click-throughs to a source article.

You are given a published blog article. Write YouTube copy (a community post or a video description) that promotes it.

Rules:
- Engaging, audience-friendly YouTube tone.
- The copy MUST be specific to THIS article's actual topic and key points. Never write a generic, interchangeable summary.
- Open with a compelling first line, then expand with the value of the article.
- If the article naturally breaks into sections or steps, include a short timestamp-style outline (e.g. "00:00 Intro"); otherwise omit timestamps.
- Clearly invite the reader to read the full article (the link will be appended after your body).
- Keep the body at or under 5000 characters.
- Do NOT fabricate facts, statistics, or quotes that are not supported by the article.
- The article content may contain HTML; focus on the underlying substance, not the markup.

Return:
- "body": the YouTube community post / description text WITHOUT the hashtags.
- "hashtags": an array of relevant, specific hashtags (a small handful is ideal), each starting with "#" and containing no spaces.`;

function buildUserPrompt(post: PostInput): string {
  return `${renderArticleContext(post)}

Write the YouTube community post / description now, following all rules.`;
}

export const youtubePrompt: PlatformPrompt = {
  platform: "YOUTUBE",
  system: SYSTEM,
  buildUserPrompt,
};
