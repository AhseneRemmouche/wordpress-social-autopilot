import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";

// Uses prisma (pg adapter) — Node runtime only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * POST /api/content/[contentId]/retry (contracts/dashboard-api.md, FR-026).
 * Owner-only. Manual retry of a FAILED item: flips it back to APPROVED and
 * re-queues its PublishJob with reset `attempts` (0), `nextRunAt` (now),
 * cleared `lastError`, and status QUEUED so the worker picks it up immediately.
 * Only FAILED items are retryable — any other state is 409. If the job row is
 * somehow missing, a fresh QUEUED job is created so the retry still runs.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ contentId: string }> },
): Promise<Response> {
  if (!(await requireOwner(request))) {
    return json({ error: "unauthorized" }, 401);
  }

  const { contentId } = await context.params;

  const content = await prisma.generatedContent.findUnique({
    where: { id: contentId },
    select: { id: true, status: true },
  });

  if (!content) {
    return json({ error: "content not found" }, 404);
  }
  if (content.status !== "FAILED") {
    return json({ error: "content is not failed", status: content.status }, 409);
  }

  await prisma.$transaction(async (tx) => {
    await tx.generatedContent.update({
      where: { id: contentId },
      data: { status: "APPROVED" },
    });
    const reset = await tx.publishJob.updateMany({
      where: { contentId },
      data: {
        status: "QUEUED",
        attempts: 0,
        nextRunAt: new Date(),
        lastError: null,
      },
    });
    if (reset.count === 0) {
      await tx.publishJob.create({ data: { content: { connect: { id: contentId } } } });
    }
  });

  return json({ status: "APPROVED", requeued: true }, 200);
}
