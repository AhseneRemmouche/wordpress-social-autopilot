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
  published: number; // jobs processed this tick (drained)
  failed: number; // jobs that failed permanently this tick
}

/**
 * Wall-clock budget for one tick (ms). The serverless runner (Netlify) kills a
 * synchronous function at ~26s, so the tick stops *starting* new work past this
 * deadline and leaves the rest for the next tick — per-item isolation and the
 * `generatedAt IS NULL` / `status=QUEUED` selectors make a resumed tick safe.
 */
export const TICK_BUDGET_MS = 20_000;

/**
 * A job left in RUNNING longer than this is presumed abandoned — a previous tick
 * claimed it (QUEUED→RUNNING) then died mid-publish (e.g. the serverless function
 * hit its ~26s cap before `processJob` finished). Because the publish pass only
 * selects QUEUED jobs, such a job would otherwise strand forever. This threshold
 * is set well above `TICK_BUDGET_MS` so a job a concurrent tick is *actively*
 * running is never reclaimed out from under it.
 */
export const STALE_RUNNING_MS = 3 * 60_000;

/**
 * Reclaim abandoned RUNNING jobs back to QUEUED so they retry on this tick.
 * Safe against a concurrent tick: the reclaimed job is re-claimed atomically in
 * `processJob`, and the already-PUBLISHED guard prevents any double-post.
 */
export async function reclaimStaleRunningJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MS);
  const { count } = await prisma.publishJob.updateMany({
    where: { status: "RUNNING", updatedAt: { lt: cutoff } },
    data: { status: "QUEUED" },
  });
  if (count > 0) {
    console.warn(`[worker] reclaimed ${count} stale RUNNING job(s) to QUEUED`);
  }
  return count;
}

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

export interface PublishPassResult {
  processed: number;
  failed: number;
}

/** Run the publish pass: drain due jobs until the deadline; count permanent failures. */
export async function runPublishPass(limit = 50, deadline = Infinity): Promise<PublishPassResult> {
  // Rescue any jobs stranded in RUNNING by a crashed/timed-out earlier tick, so
  // they become due again and get drained below instead of stalling forever.
  await reclaimStaleRunningJobs();

  const jobs = await prisma.publishJob.findMany({
    where: { status: "QUEUED", nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });

  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    if (Date.now() > deadline) break; // out of budget → resume next tick
    try {
      if ((await processJob(job.id)) === "failed") failed++;
    } catch (error) {
      // An unexpected throw (processJob handles publish failures internally) is
      // itself a failure worth counting/surfacing.
      console.error(`[worker] publish failed for job ${job.id}:`, errMsg(error));
      failed++;
    }
    processed++;
  }

  return { processed, failed };
}

/**
 * Run one full tick (generation then publish), bounded by `budgetMs` so a large
 * backlog can't run past the serverless timeout. Returns how many of each ran
 * plus how many jobs failed permanently (for the tick response + alerting).
 */
export async function runTick(budgetMs = TICK_BUDGET_MS): Promise<TickResult> {
  const deadline = Date.now() + budgetMs;
  const generated = await runGenerationPass(25, deadline);
  const publish = await runPublishPass(50, deadline);
  return { generated, published: publish.processed, failed: publish.failed };
}

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "unknown error";
}
