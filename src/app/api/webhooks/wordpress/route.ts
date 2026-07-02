import { prisma } from "@/lib/prisma";
import { fetchFullPost } from "@/lib/wordpress/novamira";
import {
  type CompletePost,
  type WebhookPayload,
  completePostSchema,
  getMissingGenerationFields,
  webhookPayloadSchema,
} from "@/lib/wordpress/schema";
import { verifySignature } from "@/lib/webhook/verify";

// Uses node:crypto (verify) and the pg driver adapter (prisma) — Node runtime only.
export const runtime = "nodejs";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function nonEmpty(value: string | null | undefined): string | undefined {
  return value && value.trim().length > 0 ? value : undefined;
}

/** Merge the (partial) webhook payload over the backfilled full post. */
function mergePost(payload: WebhookPayload, full: CompletePost): CompletePost {
  return completePostSchema.parse({
    wpPostId: payload.wpPostId,
    title: nonEmpty(payload.title) ?? full.title,
    content: nonEmpty(payload.content) ?? full.content,
    excerpt: nonEmpty(payload.excerpt) ?? full.excerpt,
    featuredImageUrl: nonEmpty(payload.featuredImageUrl) ?? full.featuredImageUrl,
    url: nonEmpty(payload.url) ?? full.url,
    categories: payload.categories.length > 0 ? payload.categories : full.categories,
    tags: payload.tags.length > 0 ? payload.tags : full.tags,
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * WordPress publish webhook (FR-001/002/003/006, contracts/webhook.md, plan §3).
 *
 * Verifies the HMAC signature, parses the payload, backfills missing fields via
 * NovaMira, and persists ONLY the WordPressPost (generatedAt = null) — content
 * generation and publishing happen later in the worker's generation pass. Returns
 * 202 immediately so the sender is never kept waiting.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  // 1. Verify signature over the RAW body before any processing (FR-002).
  if (!verifySignature(rawBody, request.headers.get("x-wsa-signature"))) {
    return json({ error: "invalid signature" }, 401);
  }

  // 2. Parse JSON + validate the (lenient) payload shape (FR-004).
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const parsed = webhookPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return json({ error: "invalid webhook payload" }, 400);
  }
  const payload = parsed.data;

  // 3. Resolve a generation-ready post, backfilling via NovaMira if needed (FR-005).
  let postData: CompletePost;
  let sourceComplete = true;
  if (getMissingGenerationFields(payload).length > 0) {
    sourceComplete = false;
    try {
      const full = await fetchFullPost({
        wpPostId: payload.wpPostId,
        url: payload.url,
      });
      postData = mergePost(payload, full);
    } catch {
      // Incomplete and un-backfillable → reject; never publish partial content.
      return json({ error: "post data incomplete and backfill failed" }, 400);
    }
  } else {
    const complete = completePostSchema.safeParse(payload);
    if (!complete.success) {
      return json({ error: "invalid post data" }, 400);
    }
    postData = complete.data;
  }

  // 4. Persist only the post (dedupe on wpPostId; never reprocess — FR-006).
  try {
    const existing = await prisma.wordPressPost.findUnique({
      where: { wpPostId: postData.wpPostId },
      select: { id: true },
    });
    if (existing) {
      return json({ accepted: true, duplicate: true, postId: existing.id }, 200);
    }

    const post = await prisma.wordPressPost.create({
      data: {
        wpPostId: postData.wpPostId,
        title: postData.title,
        content: postData.content,
        excerpt: postData.excerpt,
        featuredImageUrl: postData.featuredImageUrl,
        url: postData.url,
        categories: postData.categories,
        tags: postData.tags,
        sourceComplete,
        generatedAt: null,
      },
      select: { id: true },
    });

    // 5. Acknowledge immediately (FR-003); the worker handles generation.
    return json({ accepted: true, postId: post.id }, 202);
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Concurrent duplicate webhook — already persisted by the first request.
      return json({ accepted: true, duplicate: true }, 200);
    }
    console.error("[webhook] failed to persist WordPressPost");
    return json({ error: "internal error" }, 500);
  }
}
