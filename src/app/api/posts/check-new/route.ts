import { generateForPost } from "@/lib/ai/generate";
import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";
import { createPostIfNew } from "@/lib/wordpress/ingest";
import { fetchFullPost, fetchLatestPostIds } from "@/lib/wordpress/novamira";

// Uses prisma (pg adapter) + the Anthropic SDK (generate) — Node runtime only.
export const runtime = "nodejs";
// Give the function headroom for inline generation (Netlify caps synchronous
// functions ~26s). The time budget below keeps us returning before this.
export const maxDuration = 26;

/**
 * Stop *starting* new generations once this much wall-clock has elapsed, so the
 * function always returns a response instead of being killed mid-work. Anything
 * left over stays `generatedAt = null` and is finished on the next click.
 */
const GENERATE_BUDGET_MS = 20_000;

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
 * their six platform variants — but **bounded**: it generates within a wall-clock
 * budget and leaves the rest `pending` (resumable on the next click) rather than
 * overrunning the serverless timeout. As long as WordPress is reachable it returns
 * 200 with `{ checked, imported, generated, pending }`, so the UI never sees a
 * failure just because a backlog didn't finish in one shot.
 *
 * Does NOT publish — variants stay PENDING unless a platform's auto-publish is on
 * (generation only enqueues those jobs; the worker's publish pass sends them).
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await requireOwner(request))) return json({ error: "unauthorized" }, 401);

  const startedAt = Date.now();

  let refs;
  try {
    refs = await fetchLatestPostIds(5);
  } catch {
    return json({ error: "could not reach WordPress" }, 502);
  }

  // Look up which of the latest are already stored AND whether they're generated,
  // so we can (a) skip fully-processed posts and (b) resume imported-but-ungenerated
  // ones (generatedAt = null) instead of orphaning them.
  const existing = await prisma.wordPressPost.findMany({
    where: { wpPostId: { in: refs.map((r) => r.wpPostId) } },
    select: { id: true, wpPostId: true, generatedAt: true },
  });
  const existingByWpId = new Map(existing.map((e) => [e.wpPostId, e]));

  let imported = 0; // newly inserted rows this call
  let generated = 0; // posts generated this call
  let pending = 0; // needs-work posts left ungenerated (budget hit or errored)

  // Newest first. For each: ensure imported, then generate within the budget.
  for (const ref of refs) {
    const known = existingByWpId.get(ref.wpPostId);
    if (known?.generatedAt) continue; // already fully processed

    try {
      // Resolve the DB row id (import the full post if it isn't stored yet).
      let postId = known?.id ?? null;
      if (!postId) {
        const full = await fetchFullPost({ wpPostId: ref.wpPostId, url: ref.url });
        const res = await createPostIfNew(full);
        if (res.created) imported++;
        postId = res.postId; // null on a concurrent-insert race
      }
      if (!postId) continue;

      // Out of budget → leave it for the next click rather than risk a timeout.
      if (Date.now() - startedAt > GENERATE_BUDGET_MS) {
        pending++;
        continue;
      }

      const post = await prisma.wordPressPost.findUnique({ where: { id: postId } });
      if (!post || post.generatedAt) continue; // gone or already generated (race)

      await generateForPost(post);
      generated++;
    } catch {
      console.error(`[check-new] failed to process post ${ref.wpPostId}`);
      pending++; // couldn't finish now; a later click can retry it
    }
  }

  return json({ checked: refs.length, imported, generated, pending }, 200);
}
