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
 * POST /api/content/[contentId]/reject (contracts/dashboard-api.md, FR-015).
 * Owner-only. Sets the item to REJECTED and — critically — it MUST never
 * publish: any still-QUEUED PublishJob for this content is deleted in the same
 * transaction so the worker's publish pass cannot pick it up. Rejecting an
 * already-PUBLISHED item is refused (409) since a live post cannot be unpublished.
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
  if (content.status === "PUBLISHED") {
    return json({ error: "cannot reject a published item", status: content.status }, 409);
  }

  // Atomic: flip to REJECTED and cancel any queued publish so it can never run.
  await prisma.$transaction([
    prisma.generatedContent.update({
      where: { id: contentId },
      data: { status: "REJECTED" },
    }),
    prisma.publishJob.deleteMany({
      where: { contentId, status: "QUEUED" },
    }),
  ]);

  return json({ status: "REJECTED" }, 200);
}
