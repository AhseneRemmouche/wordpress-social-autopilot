import { z } from "zod";

import { requireOwner } from "@/lib/oauth/session";
import { prisma } from "@/lib/prisma";

// Uses prisma (pg adapter) — Node runtime only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Request body (Zod-validated at the boundary — Principle I). */
const bodySchema = z.object({
  platform: z.enum(["LINKEDIN", "FACEBOOK", "INSTAGRAM", "X", "TIKTOK", "YOUTUBE"]),
  autoPublish: z.boolean(),
});

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * PATCH /api/settings/auto-publish (contracts/dashboard-api.md, FR-025). Owner-only.
 * Toggles ONE platform's auto-publish flag independently of the others. Upserts so
 * the preference persists even before the platform is connected (a not-yet-connected
 * row is created DISCONNECTED). Affects only subsequent posts.
 */
export async function PATCH(request: Request): Promise<Response> {
  if (!(await requireOwner(request))) {
    return json({ error: "unauthorized" }, 401);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "invalid body" }, 400);
  }

  const { platform, autoPublish } = parsed.data;

  await prisma.platformAccount.upsert({
    where: { platform },
    create: { platform, autoPublish, status: "DISCONNECTED" },
    update: { autoPublish },
  });

  return json({ platform, autoPublish }, 200);
}
