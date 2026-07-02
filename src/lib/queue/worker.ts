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

/** Run the generation pass: process every not-yet-generated post. */
export async function runGenerationPass(limit = 25): Promise<number> {
  const posts = await prisma.wordPressPost.findMany({
    where: { generatedAt: null },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });

  for (const post of posts) {
    try {
      await generateForPost(post);
    } catch (error) {
      // generateForPost isolates per-platform failures internally; a throw here
      // is unexpected (e.g. the final stamp). Log without secrets and continue.
      console.error(`[worker] generation failed for post ${post.id}:`, errMsg(error));
    }
  }

  return posts.length;
}

/** Run the publish pass: drain every due job. */
export async function runPublishPass(limit = 50): Promise<number> {
  const jobs = await prisma.publishJob.findMany({
    where: { status: "QUEUED", nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });

  for (const job of jobs) {
    try {
      await processJob(job.id);
    } catch (error) {
      console.error(`[worker] publish failed for job ${job.id}:`, errMsg(error));
    }
  }

  return jobs.length;
}

/** Run one full tick (generation then publish). Returns how many of each ran. */
export async function runTick(): Promise<TickResult> {
  const generated = await runGenerationPass();
  const published = await runPublishPass();
  return { generated, published };
}

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : "unknown error";
}
