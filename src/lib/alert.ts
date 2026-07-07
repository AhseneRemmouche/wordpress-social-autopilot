import { env } from "@/lib/env";

/**
 * Best-effort operator alert (Constitution Principle II — secret-free).
 *
 * POSTs a short message to `ALERT_WEBHOOK_URL` (a Slack/Discord/Teams-compatible
 * incoming webhook) as `{ "text": ... }`. It is a **no-op when the webhook is
 * unset** (fail-open, like the cron runner), never throws, and must only be
 * called with platform/status/HTTP-level context — never tokens or bodies.
 */
export async function sendAlert(text: string): Promise<void> {
  const url = env.ALERT_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // Alerting must never break the worker; swallow transport errors.
  }
}
