import { prisma } from "@/lib/prisma";

/**
 * Enqueue a publish job for a generated content item (plan §8). Defaults
 * (QUEUED, attempts 0, maxAttempts 3, nextRunAt now) come from the schema.
 * Called by the generation pass (auto-publish) and the approve route.
 */
export async function enqueuePublish(contentId: string): Promise<void> {
  await prisma.publishJob.create({
    data: { content: { connect: { id: contentId } } },
  });
}
