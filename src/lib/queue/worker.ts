import { generateForPost } from "@/lib/ai/generate";
import { prisma } from "@/lib/prisma";
import { processJob } from "@/lib/queue/process-job";

/**
 * Queue worker (plan §8). One "tick" runs two passes in order:
 *
 *  1. Generation pass — every WordPressPost with `generatedAt IS NULL` is run
 *     through `generateForPost` (creates the six GeneratedContent rows, enqueues
 *     auto-publish jobs, stamps `generatedAt`).
 *  2. Publish pass — every due PublishJob (`status = QUEUED` and
 *     `nextRunAt <= now`) is drained through `processJob`.
 *
 * Each unit is isolated: one post's or job's failure never aborts the tick
 * (per-platform / per-item isolation, FR-016/FR-030). The worker holds no
 * platform-specific logic — that lives in the generators and publishers.
 */

export interface TickResult {
  generated: number;
  published: number;
}

/**
 * Wall-clock budget for one tick (ms). The serverless runner (Netlify) kills a
 * synchronous function at ~26s, so the tick stops *starting* new work past this
 * deadline and leaves the rest for the next tick — per-item isolation and the
 * `generatedAt IS NULL` / `status=QUEUED` selectors make a resumed tick safe.
 */
export const TICK_BUDGET_MS = 20_000;

/** Run the generation pass: process not-yet-generated posts until the deadline. */
export async function runGenerationPass(limit = 25, deadline = Infinity): Promise<number> {
  const posts = await prisma.wordPressPost.findMany({
    where: { generatedAt: null },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });

  let processed = 0;
  for (const post of posts) {
    if (Date.now() > deadline) break; // out of budget → resume next tick
    try {
      await generateForPost(post);
    } catch (error) {
      // generateForPost isolates per-platform failures internally; a throw here
      // is unexpected (e.g. the final stamp). Log without secrets and continue.
      console.error(`[worker] generation failed for post ${post.id}:`, errMsg(error));
    }
    processed++;
  }

  return processed;
}

/** Run the publish pass: drain due jobs until the deadline. */
export async function runPublishPass(limit = 50, deadline = Infinity): Promise<number> {
  const jobs = await prisma.publishJob.findMany({
    where: { status: "QUEUED", nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });

  let processed = 0;
  for (const job of jobs) {
    if (Date.now() > deadline) break; // out of budget → resume next tick
    try {
      await processJob(job.id);
    } catch (error) {
      console.error(`[worker] publish failed for job ${job.id}:`, errMsg(error));
    }
    processed++;
  }

  return processed;
}

/**
 * Run one full tick (generation then publish), bounded by `budgetMs` so a large
 * backlog can't run past the serverless timeout. Returns how many of each ran.
 */
export async function runTick(budgetMs = TICK_BUDGET_MS): Promise<TickResult> {
  const deadline = Date.now() + budgetMs;
  const generated = await runGenerationPass(25, deadline);
  const published = await runPublishPass(50, deadline);
  return { generated, published };
}

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "unknown error";
}
