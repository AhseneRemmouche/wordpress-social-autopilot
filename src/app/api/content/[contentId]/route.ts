import { z } from "zod";

import { truncateToLimit } from "@/lib/limits";
import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";

// Uses prisma (pg adapter) — Node runtime only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner-supplied caption edit. Hashtags optional (keep existing when omitted). */
const editSchema = z.object({
  body: z.string().min(1).max(20_000),
  hashtags: z.array(z.string()).max(30).optional(),
});

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * PATCH /api/content/[contentId]. Owner-only. Edits a generated caption before it
 * publishes: overwrites `body` (+ optional `hashtags`), re-applying the backlink
 * and the platform character limit via `truncateToLimit` and recomputing
 * `charCount` — exactly as generation does. A PUBLISHED item is immutable (409).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ contentId: string }> },
): Promise<Response> {
  if (!(await requireOwner(request))) {
    return json({ error: "unauthorized" }, 401);
  }

  const { contentId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  const parsed = editSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: "invalid content edit" }, 400);
  }

  const content = await prisma.generatedContent.findUnique({
    where: { id: contentId },
    select: { status: true, platform: true, link: true, hashtags: true },
  });
  if (!content) {
    return json({ error: "content not found" }, 404);
  }
  if (content.status === "PUBLISHED") {
    return json({ error: "cannot edit a published item", status: content.status }, 409);
  }

  const body = truncateToLimit(parsed.data.body, content.link, content.platform);
  const hashtags = parsed.data.hashtags ?? content.hashtags;

  const updated = await prisma.generatedContent.update({
    where: { id: contentId },
    data: { body, hashtags, charCount: body.length },
    select: { body: true, hashtags: true, charCount: true, status: true },
  });

  return json(updated, 200);
}
