# WordPress Social Autopilot

A **Next.js** automation hub: when you publish a post on your WordPress site, a
signature-verified webhook fires to this app, which uses **Claude** to generate
platform-tailored social content — each linking back to the original post — and
then publishes or queues it to **LinkedIn, Instagram, Facebook, YouTube, X, and
TikTok**. A single-owner dashboard handles preview/approve/reject, per-platform
auto-publish toggles, publish status, manual retry, and OAuth connect/disconnect.

Reliability by design: failures are logged, publishes auto-retry 3× with
exponential backoff + jitter, one platform's failure never blocks the others, and
the webhook acknowledges immediately (generation/publishing happen in a worker).

## Confirmed stack

| Area | Choice |
|---|---|
| Framework | Next.js 16.2.9 (App Router) |
| Language | TypeScript 6.0.3 (strict, `noUncheckedIndexedAccess`) |
| DB / ORM | PostgreSQL + Prisma 7.8.0 (pg driver adapter) |
| Validation | Zod 4.4.3 (at every boundary) |
| Auth | NextAuth.js 4.24.14 (GitHub, single-owner allowlist) |
| Styling | Tailwind CSS 4.3.2 |
| AI | `@anthropic-ai/sdk` 0.107.0 — model `claude-opus-4-8`, adaptive thinking |
| HTTP | Node native `fetch` (per-platform publishers) |
| WordPress fallback | NovaMira MCP (backfills missing webhook fields) |
| Tests | Vitest 4 (+ v8 coverage) |
| Worker | `tsx` (long-lived) or a serverless cron tick |

Versions are pinned and were confirmed against upstream docs in
[`specs/001-social-autopilot/research.md`](specs/001-social-autopilot/research.md).

## Architecture at a glance

```
WordPress publish
      │  signed webhook (HMAC-SHA256)
      ▼
/api/webhooks/wordpress ──► WordPressPost (generatedAt = null)   [202 immediately]
      │
worker tick ── generation pass ─► Claude ×6 platforms ─► GeneratedContent (+status)
      │                                    │ auto-publish + connected → enqueue
      └──────── publish pass ─► PublishJob ─► per-platform Publisher ─► PUBLISHED
                                     │ retryable → backoff requeue (≤3) → FAILED
```

Tokens are encrypted at rest (AES-256-GCM); nothing sensitive is ever logged.

## Setup

Prerequisites: **Node ≥ 22**, a **PostgreSQL** database.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    Fill in every value. See docs/deployment.md for how to generate the secrets
#    and register each platform's OAuth app + redirect URIs.

# 3. Apply the database schema
npx prisma migrate dev

# 4. Run the app and the queue worker (separate terminals)
npm run dev       # Next.js dev server → http://localhost:3000
npm run worker    # queue worker: generation + publish passes on an interval
```

Sign in at `/signin` with the GitHub account set as `OWNER_GITHUB_LOGIN`, then
connect platforms under **Connections**.

> No Postgres handy? `docker compose up postgres` starts one — or bring up the
> whole stack (app + worker included) with `docker compose up --build`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run worker` | Long-lived queue worker (`src/worker/index.ts`) |
| `npm run worker:dev` | Worker with file-watch |
| `npm test` / `npm run test:ci` | Vitest suite / suite + coverage gate |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |

## Queue: worker vs. cron

Run **one** per deployment: the long-lived `npm run worker`, **or** schedule
`POST /api/worker/tick` (secret-guarded via `CRON_SECRET`) from Vercel Cron / a
timer. Don't run both against the same database. See
[`docs/deployment.md`](docs/deployment.md) §6.

## Validate end-to-end

The runnable acceptance scenarios (sign-in & connect, webhook → generation →
publish, approve/reject, failure → retry → recovery, backfill, token-expiry
alert) live in
**[`specs/001-social-autopilot/quickstart.md`](specs/001-social-autopilot/quickstart.md)**.

Automated coverage of every Principle VII requirement and success criterion is
mapped in [`tests/COVERAGE.md`](tests/COVERAGE.md); run it all with `npm test`.

## Deployment

**Production:** _<!-- set after the first production deploy, e.g. https://autopilot.example.com -->_ · Vercel (web + cron), worker container run separately (`docs/deployment.md` §8).

Secret generation, per-platform OAuth setup, redirect URIs, and the full env
checklist are in **[`docs/deployment.md`](docs/deployment.md)**. Container builds:
`Dockerfile` (app), `Dockerfile.worker` (worker), `docker-compose.yml`
(Postgres + web + worker, migrations applied on start via `scripts/start.sh`).

### Go-live checklist

1. Set every env var (`docs/deployment.md` §5) in Vercel **Production** (+ `CRON_SECRET`);
   point `DATABASE_URL` at the hosted Postgres.
2. `npx prisma migrate deploy` against the production DB.
3. Register the **production** OAuth redirect URIs (GitHub + each platform).
4. **Promote to production** (Vercel → Deployments → Promote), then paste the URL above.
5. **Smoke-test the live UI**: sign in as the owner → dashboard loads → send a signed
   test webhook (`quickstart.md` Scenario B) → open the post → run one action
   (approve/reject) end-to-end → confirm a connection card and the theme toggle.
6. Confirm the cron is firing (`/api/worker/tick` returns 200 with the `CRON_SECRET`
   bearer) or the worker container is running.

## How this was built

Spec-Driven Development (Spec Kit): the design artifacts in
`specs/001-social-autopilot/` (`spec.md`, `plan.md`, `research.md`,
`data-model.md`, `contracts/`, `quickstart.md`) and the project constitution in
`.specify/memory/constitution.md` drove the implementation, prompt by prompt via
[`ALL-PROMPTS.md`](ALL-PROMPTS.md).
