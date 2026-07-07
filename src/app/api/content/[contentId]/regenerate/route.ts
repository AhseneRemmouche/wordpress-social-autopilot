import { regeneratePlatform } from "@/lib/ai/generate";
import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";

// Uses prisma (pg adapter) + the Anthropic SDK — Node runtime only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One Opus call with adaptive thinking; give it headroom (Netlify caps lower).
export const maxDuration = 60;

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * POST /api/content/[contentId]/regenerate. Owner-only. Re-runs Claude for one
 * platform and overwrites the caption, resetting it to PENDING for re-approval.
 * Only PENDING or FAILED items are regenerable (409 otherwise) — an APPROVED item
 * has a queued job and a PUBLISHED one is already live.
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
    select: { status: true },
  });
  if (!content) {
    return json({ error: "content not found" }, 404);
  }
  if (content.status !== "PENDING" && content.status !== "FAILED") {
    return json(
      { error: "only pending or failed content can be regenerated", status: content.status },
      409,
    );
  }

  const result = await regeneratePlatform(contentId);
  if (!result.ok) {
    return json({ error: "regeneration failed" }, 502);
  }

  return json(
    { status: "PENDING", body: result.body, hashtags: result.hashtags, charCount: result.charCount },
    200,
  );
}
