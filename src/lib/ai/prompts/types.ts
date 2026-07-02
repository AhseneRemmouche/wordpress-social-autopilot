import type { Platform } from "@prisma/client";

/** The post fields available to a prompt when generating platform content. */
export interface PostInput {
  title: string;
  content: string;
  excerpt: string;
  url: string;
  categories: string[];
  tags: string[];
  featuredImageUrl: string | null;
}

/**
 * A version-controlled prompt for one platform (Constitution Principle IV —
 * prompts are named constants, never assembled inline at call sites). The system
 * string holds the static rules; `buildUserPrompt` injects the specific post.
 */
export interface PlatformPrompt {
  platform: Platform;
  system: string;
  buildUserPrompt(post: PostInput): string;
}

/** Render the shared article context block used by every platform's user prompt. */
export function renderArticleContext(post: PostInput): string {
  const meta = [
    `Title: ${post.title}`,
    `URL: ${post.url}`,
    post.categories.length > 0 ? `Categories: ${post.categories.join(", ")}` : null,
    post.tags.length > 0 ? `Tags: ${post.tags.join(", ")}` : null,
    post.excerpt ? `Excerpt: ${post.excerpt}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return `Article details:\n${meta}\n\nArticle content:\n${post.content}`;
}
