import { generateForPost } from "@/lib/ai/generate";
import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";
import { createPostIfNew } from "@/lib/wordpress/ingest";
import { fetchFullPost, fetchLatestPostIds } from "@/lib/wordpress/novamira";

// Uses prisma (pg adapter) + the Anthropic SDK (generate) — Node runtime only.
export const runtime = "nodejs";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * POST /api/posts/check-new — owner-only manual pull for the dashboard
 * "Check for new posts" button. Lists the latest published posts on the
 * WordPress site (public REST), imports any not already stored, and generates
 * their platform content inline so they appear fully processed on the dashboard.
 * Does NOT publish — variants stay PENDING unless a platform's auto-publish is on
 * (the generation pass enqueues those jobs, drained by the worker as usual).
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await requireOwner(request))) return json({ error: "unauthorized" }, 401);

  let refs;
  try {
    refs = await fetchLatestPostIds(5);
  } catch {
    return json({ error: "could not reach WordPress" }, 502);
  }

  // Dedupe before fetching content: skip ids we already have.
  const existing = await prisma.wordPressPost.findMany({
    where: { wpPostId: { in: refs.map((r) => r.wpPostId) } },
    select: { wpPostId: true },
  });
  const known = new Set(existing.map((e) => e.wpPostId));
  const fresh = refs.filter((r) => !known.has(r.wpPostId));

  const imported: Array<{ postId: string; title: string }> = [];
  for (const ref of fresh) {
    // Per-post isolation: one post's failure never aborts the rest.
    try {
      const full = await fetchFullPost({ wpPostId: ref.wpPostId, url: ref.url });
      const { postId, created } = await createPostIfNew(full);
      if (!created || !postId) continue;

      const post = await prisma.wordPressPost.findUnique({ where: { id: postId } });
      if (post) {
        await generateForPost(post);
        imported.push({ postId, title: full.title });
      }
    } catch {
      console.error(`[check-new] failed to import post ${ref.wpPostId}`);
    }
  }

  return json({ checked: refs.length, count: imported.length, imported }, 200);
}
