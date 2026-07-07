import { sendAlert } from "@/lib/alert";
import { env } from "@/lib/env";
import { accountAutoRenews } from "@/lib/oauth/config";
import { prisma } from "@/lib/prisma";

// Uses prisma (pg adapter) — Node runtime only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Warn when a non-refreshable token expires within this window. */
const WARN_WITHIN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** Re-alert at most this often per account (~once/day). */
const ALERT_THROTTLE_MS = 20 * 60 * 60 * 1000;

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Scheduled token-expiry reminder (Phase 2 observability).
 *
 * LinkedIn/Meta tokens last ~60 days with no refresh grant, so they otherwise
 * fail silently the day they lapse. This scans CONNECTED accounts whose provider
 * cannot self-refresh and whose `expiresAt` is within the warning window, and
 * sends a secret-free reconnect reminder — throttled to ~once/day per account via
 * `metadata.lastExpiryAlertAt`. Fail-closed like /api/worker/tick: 503 without
 * `CRON_SECRET`, 401 without the bearer.
 */
async function handle(request: Request): Promise<Response> {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return json({ error: "token-check is disabled; set CRON_SECRET to enable" }, 503);
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const now = Date.now();
  const soon = new Date(now + WARN_WITHIN_MS);

  const accounts = await prisma.platformAccount.findMany({
    where: { status: "CONNECTED", expiresAt: { not: null, lte: soon } },
  });

  let alerted = 0;
  for (const acct of accounts) {
    // Skip accounts that truly auto-renew — Meta's non-expiring Page token, or a
    // refresh-capable provider that actually holds a refresh token (X/TikTok/Google,
    // and LinkedIn once provisioned). Only genuinely-expiring tokens get a reminder.
    if (accountAutoRenews(acct.platform, Boolean(acct.refreshToken))) continue;

    // Throttle so a still-unreconnected account doesn't alert on every run.
    const meta = (acct.metadata as Record<string, unknown> | null) ?? {};
    const last =
      typeof meta.lastExpiryAlertAt === "string" ? Date.parse(meta.lastExpiryAlertAt) : 0;
    if (now - last < ALERT_THROTTLE_MS) continue;

    const days = acct.expiresAt
      ? Math.max(0, Math.round((acct.expiresAt.getTime() - now) / 86_400_000))
      : 0;
    await sendAlert(
      `🔑 ${acct.platform} token expires in ~${days} day(s) — reconnect on /connections to keep auto-publishing.`,
    );
    await prisma.platformAccount.update({
      where: { platform: acct.platform },
      data: { metadata: { ...meta, lastExpiryAlertAt: new Date(now).toISOString() } },
    });
    alerted++;
  }

  return json({ ok: true, checked: accounts.length, alerted }, 200);
}

export function GET(request: Request): Promise<Response> {
  return handle(request);
}
export function POST(request: Request): Promise<Response> {
  return handle(request);
}
