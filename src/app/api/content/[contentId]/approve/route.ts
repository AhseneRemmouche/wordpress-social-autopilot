import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";
import { enqueuePublish } from "@/lib/queue/enqueue";

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
 * POST /api/content/[contentId]/approve (contracts/dashboard-api.md, FR-015).
 * Owner-only. Approves a PENDING generated item: flips it to APPROVED and
 * enqueues a PublishJob. Only PENDING is approvable — any other state is 409
 * (already published/rejected/failed/manual). APPROVED is set BEFORE the job is
 * enqueued so a failed enqueue can never leave a job pointing at un-approved
 * content.
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
  if (content.status !== "PENDING") {
    return json({ error: "content is not pending", status: content.status }, 409);
  }

  await prisma.generatedContent.update({
    where: { id: contentId },
    data: { status: "APPROVED" },
  });
  await enqueuePublish(contentId);

  return json({ status: "APPROVED" }, 200);
}
