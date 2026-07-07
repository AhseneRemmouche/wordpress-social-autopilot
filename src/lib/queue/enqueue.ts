import { prisma } from "@/lib/prisma";

/**
 * Enqueue a publish job for a generated content item (plan §8). Defaults
 * (QUEUED, attempts 0, maxAttempts 3, nextRunAt now) come from the schema.
 * Called by the generation pass (auto-publish) and the approve route.
 *
 * Idempotent against double-enqueue: if the content already has a live
 * (QUEUED/RUNNING) job, this is a no-op — so a re-run of generation (e.g. after a
 * partially-completed tick) can't create a duplicate job that double-publishes.
 */
export async function enqueuePublish(contentId: string): Promise<void> {
  const existing = await prisma.publishJob.findFirst({
    where: { contentId, status: { in: ["QUEUED", "RUNNING"] } },
    select: { id: true },
  });
  if (existing) return;

  await prisma.publishJob.create({
    data: { content: { connect: { id: contentId } } },
  });
}
