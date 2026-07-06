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
 * POST /api/content/[contentId]/mark-published. Owner-only. Records that a
 * MANUAL_REQUIRED item (YouTube, or image-less IG/TikTok) was posted by hand:
 * flips it to PUBLISHED. Only MANUAL_REQUIRED is markable — any other state is
 * 409. No job/enqueue side effects (there was never anything to publish here).
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
  if (content.status !== "MANUAL_REQUIRED") {
    return json({ error: "content is not manual", status: content.status }, 409);
  }

  await prisma.generatedContent.update({
    where: { id: contentId },
    data: { status: "PUBLISHED" },
  });

  return json({ status: "PUBLISHED" }, 200);
}
