import { env } from "@/lib/env";
import { runTick } from "@/lib/queue/worker";

// Uses the pg driver adapter (prisma) and the Anthropic SDK — Node runtime only.
export const runtime = "nodejs";
// Never cache: each call must drain the live queue.
export const dynamic = "force-dynamic";
// A tick can generate for six platforms + publish; allow a long budget (Vercel
// clamps to the plan maximum). Heavy backlogs favour the long-lived worker.
export const maxDuration = 300;

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Serverless cron-tick runner (plan §8 Simplification Note). A single request
 * drains one worker tick (generation pass + publish pass) and returns the counts.
 * Point a scheduler (Vercel Cron, GitHub Actions, systemd timer, …) at this in
 * deployments that prefer stateless ticks over the long-lived worker process.
 *
 * Fail-closed (Principle II): the endpoint is DISABLED unless `CRON_SECRET` is
 * configured (503), and every request must carry `Authorization: Bearer
 * <CRON_SECRET>` (401 otherwise). It is never open. Vercel Cron auto-adds this
 * header when CRON_SECRET is set as a project env var. Accepts GET (Vercel Cron
 * uses GET) and POST.
 */
async function handle(request: Request): Promise<Response> {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return json({ error: "worker tick is disabled; set CRON_SECRET to enable" }, 503);
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const result = await runTick();
    return json({ ok: true, ...result }, 200);
  } catch (error) {
    console.error(
      "[worker/tick] failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return json({ ok: false, error: "tick failed" }, 500);
  }
}

export function GET(request: Request): Promise<Response> {
  return handle(request);
}

export function POST(request: Request): Promise<Response> {
  return handle(request);
}
