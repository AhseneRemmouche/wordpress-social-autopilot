/**
 * Netlify Scheduled Function — the reliable worker cron.
 *
 * Publishing is driven by the queue worker's tick endpoint. The GitHub Actions
 * every-5-minutes cron (`.github/workflows/worker-tick.yml`) that used to be the
 * only trigger is heavily throttled by GitHub — real runs were observed hours
 * apart — which left owner-approved posts sitting QUEUED far longer than expected.
 *
 * Netlify's own scheduler fires on time (min interval 1 min), so this function is
 * now the primary driver: every 5 minutes it POSTs the existing fail-closed tick
 * endpoint (`/api/worker/tick`), which runs one generation + one publish pass.
 *
 * - Auth: reuses `CRON_SECRET` (already set on Netlify) as the bearer token.
 * - `URL` is injected by Netlify at runtime (the site's primary URL).
 * - Safe to run alongside the GitHub Actions cron (kept as a backup): the tick is
 *   idempotent and concurrency-safe via the atomic QUEUED->RUNNING claim and the
 *   already-PUBLISHED guard in `src/lib/queue/process-job.ts`, so a double fire
 *   can never double-post.
 *
 * Plain `.mjs` (no type import) so it lints cleanly and needs no extra dependency;
 * Netlify reads the exported `config.schedule` at deploy time.
 */
const handler = async () => {
  const base = process.env.URL ?? "https://wordpress-social-autopilot.netlify.app";
  const secret = process.env.CRON_SECRET ?? "";
  const res = await fetch(`${base}/api/worker/tick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  console.log(`[netlify-cron] worker tick -> HTTP ${res.status} ${body}`);
  return new Response(null, { status: 204 });
};

export default handler;

export const config = { schedule: "*/5 * * * *" };
