import { prisma } from "@/lib/prisma";
import type { CompletePost } from "@/lib/wordpress/schema";

/**
 * Shared post-ingestion helper (used by the WordPress webhook and the dashboard
 * "Check for new posts" pull). Persists a WordPressPost with `generatedAt = null`
 * so the generation pass picks it up, deduping on the unique `wpPostId`. Never
 * reprocesses an existing post.
 */

export interface CreatePostResult {
  /** The row id — of the newly created post, or the existing duplicate. */
  postId: string | null;
  /** True only when this call inserted a new row. */
  created: boolean;
}

/** Prisma unique-constraint violation (concurrent duplicate insert). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Insert the post if its `wpPostId` isn't already stored (FR-006). Returns the
 * existing row's id with `created: false` when it's a duplicate; on a concurrent
 * insert (P2002) returns `{ postId: null, created: false }`.
 */
export async function createPostIfNew(
  post: CompletePost,
  sourceComplete = true,
): Promise<CreatePostResult> {
  const existing = await prisma.wordPressPost.findUnique({
    where: { wpPostId: post.wpPostId },
    select: { id: true },
  });
  if (existing) return { postId: existing.id, created: false };

  try {
    const created = await prisma.wordPressPost.create({
      data: {
        wpPostId: post.wpPostId,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        featuredImageUrl: post.featuredImageUrl,
        url: post.url,
        categories: post.categories,
        tags: post.tags,
        sourceComplete,
        generatedAt: null,
      },
      select: { id: true },
    });
    return { postId: created.id, created: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { postId: null, created: false };
    throw error;
  }
}
