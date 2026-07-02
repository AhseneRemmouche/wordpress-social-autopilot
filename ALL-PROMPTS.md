# ALL-PROMPTS.md — WordPress Social Autopilot Implementation Playbook

A complete, paste-one-at-a-time recipe to build the entire project. **One prompt per task**
from `specs/001-social-autopilot/tasks.md`, in execution order. Each prompt is self-contained —
paste it into Claude Code as-is.

## Global Context (true for every prompt)

- **Project**: WordPress Social Autopilot — a Next.js automation hub that turns one WordPress
  publish event into platform-tailored social posts on LinkedIn, Instagram, Facebook, YouTube,
  X/Twitter, and TikTok. Repo root: `C:\MLSCampus\wordpress-social-autopilot`.
- **Specs**: `specs/001-social-autopilot/` → `spec.md`, `plan.md`, `research.md`,
  `data-model.md`, `contracts/`, `quickstart.md`, `tasks.md`.
- **Confirmed stack (research.md, pinned)**: Next.js **16.2.9** (App Router) · TypeScript
  **6.0.3** (strict) · Zod **4.4.3** · Prisma **7.8.0** + `@prisma/client` (PostgreSQL) ·
  NextAuth.js **4.24.14** (GitHub) · Tailwind CSS **4.3.2** · `@anthropic-ai/sdk` **0.107.0**
  (model `claude-opus-4-8`, adaptive thinking) · Node **22 LTS** · native `fetch` for social APIs.
- **Platform API versions (research.md)**: LinkedIn `LinkedIn-Version: 202606` · Meta Graph
  `v25.0` · X API `v2` · TikTok Content Posting API `v2` · YouTube Data API `v3` (no
  community-post endpoint).
- **Constitution (non-negotiable in every task)**: TS strict, **no `any`** (use `unknown` +
  Zod); **Zod-validate every runtime boundary**; small single-purpose functions; **AES-256-GCM**
  token encryption; **HMAC-SHA256** webhook verify; env validated at startup; **no secrets in
  logs/audit**; Claude prompts as version-controlled constants; Zod-validate Claude output;
  Prisma is the single source of truth with error handling on every op; audit per
  attempt/success/failure; tests required (Principle VII).

---

## Table of Contents

### Phase 1 — Setup

- [PROMPT 01 — Initialize Next.js + TypeScript strict project](#prompt-01--initialize-nextjs--typescript-strict-project)
- [PROMPT 02 — Configure Tailwind CSS v4](#prompt-02--configure-tailwind-css-v4)
- [PROMPT 03 — Configure ESLint + Prettier](#prompt-03--configure-eslint--prettier)
- [PROMPT 04 — Configure Vitest](#prompt-04--configure-vitest)
- [PROMPT 05 — Zod environment loader](#prompt-05--zod-environment-loader)
- [PROMPT 06 — Test environment schema](#prompt-06--test-environment-schema)
- [PROMPT 07 — Create .env.example](#prompt-07--create-envexample)
- [PROMPT 08 — Checkpoint: Setup](#prompt-08--checkpoint-setup)

### Phase 2 — Foundational

- [PROMPT 09 — Prisma schema (all models)](#prompt-09--prisma-schema-all-models)
- [PROMPT 10 — Initial migration](#prompt-10--initial-migration)
- [PROMPT 11 — Prisma client singleton](#prompt-11--prisma-client-singleton)
- [PROMPT 12 — AES-256-GCM token crypto](#prompt-12--aes-256-gcm-token-crypto)
- [PROMPT 13 — Test crypto round-trip](#prompt-13--test-crypto-round-trip)
- [PROMPT 14 — Char limits + truncation](#prompt-14--char-limits--truncation)
- [PROMPT 15 — Test truncation](#prompt-15--test-truncation)
- [PROMPT 16 — Audit log writer](#prompt-16--audit-log-writer)
- [PROMPT 17 — Test audit writer](#prompt-17--test-audit-writer)
- [PROMPT 18 — Checkpoint: Foundation](#prompt-18--checkpoint-foundation)

### Phase 3 — WordPress Integration

- [PROMPT 19 — HMAC webhook verify](#prompt-19--hmac-webhook-verify)
- [PROMPT 20 — Test signature verify](#prompt-20--test-signature-verify)
- [PROMPT 21 — WordPress payload schema](#prompt-21--wordpress-payload-schema)
- [PROMPT 22 — Test WordPress schema](#prompt-22--test-wordpress-schema)
- [PROMPT 23 — NovaMira MCP fallback](#prompt-23--novamira-mcp-fallback)
- [PROMPT 24 — Test NovaMira fallback](#prompt-24--test-novamira-fallback)
- [PROMPT 25 — Webhook receiver route](#prompt-25--webhook-receiver-route)
- [PROMPT 26 — Webhook integration test](#prompt-26--webhook-integration-test)
- [PROMPT 27 — Checkpoint: WordPress ingestion](#prompt-27--checkpoint-wordpress-ingestion)

### Phase 4 — Claude AI Integration

- [PROMPT 28 — Anthropic client + model constant](#prompt-28--anthropic-client--model-constant)
- [PROMPT 29 — Per-platform output schemas](#prompt-29--per-platform-output-schemas)
- [PROMPT 30 — Test output schemas](#prompt-30--test-output-schemas)
- [PROMPT 31 — Checkpoint: AI scaffolding](#prompt-31--checkpoint-ai-scaffolding)

### Phase 5 — Per-Platform Content Generation

- [PROMPT 32 — LinkedIn prompt constant](#prompt-32--linkedin-prompt-constant)
- [PROMPT 33 — Test LinkedIn generation](#prompt-33--test-linkedin-generation)
- [PROMPT 34 — Checkpoint: LinkedIn content](#prompt-34--checkpoint-linkedin-content)
- [PROMPT 35 — Instagram prompt constant](#prompt-35--instagram-prompt-constant)
- [PROMPT 36 — Test Instagram generation](#prompt-36--test-instagram-generation)
- [PROMPT 37 — Checkpoint: Instagram content](#prompt-37--checkpoint-instagram-content)
- [PROMPT 38 — Facebook prompt constant](#prompt-38--facebook-prompt-constant)
- [PROMPT 39 — Test Facebook generation](#prompt-39--test-facebook-generation)
- [PROMPT 40 — Checkpoint: Facebook content](#prompt-40--checkpoint-facebook-content)
- [PROMPT 41 — YouTube prompt constant](#prompt-41--youtube-prompt-constant)
- [PROMPT 42 — Test YouTube generation](#prompt-42--test-youtube-generation)
- [PROMPT 43 — Checkpoint: YouTube content](#prompt-43--checkpoint-youtube-content)
- [PROMPT 44 — X prompt constant](#prompt-44--x-prompt-constant)
- [PROMPT 45 — Test X generation](#prompt-45--test-x-generation)
- [PROMPT 46 — Checkpoint: X content](#prompt-46--checkpoint-x-content)
- [PROMPT 47 — TikTok prompt constant](#prompt-47--tiktok-prompt-constant)
- [PROMPT 48 — Test TikTok generation](#prompt-48--test-tiktok-generation)
- [PROMPT 49 — Checkpoint: TikTok content](#prompt-49--checkpoint-tiktok-content)
- [PROMPT 50 — Prompt registry](#prompt-50--prompt-registry)
- [PROMPT 51 — generateForPost orchestrator](#prompt-51--generateforpost-orchestrator)
- [PROMPT 52 — Test generateForPost](#prompt-52--test-generateforpost)
- [PROMPT 53 — Checkpoint: Content generation](#prompt-53--checkpoint-content-generation)

### Phase 6 — Per-Platform Publishing

- [PROMPT 54 — Publisher interface + types](#prompt-54--publisher-interface--types)
- [PROMPT 55 — Publisher registry](#prompt-55--publisher-registry)
- [PROMPT 56 — LinkedIn publisher](#prompt-56--linkedin-publisher)
- [PROMPT 57 — Test LinkedIn publisher](#prompt-57--test-linkedin-publisher)
- [PROMPT 58 — Checkpoint: LinkedIn publishing](#prompt-58--checkpoint-linkedin-publishing)
- [PROMPT 59 — Instagram publisher](#prompt-59--instagram-publisher)
- [PROMPT 60 — Test Instagram publisher](#prompt-60--test-instagram-publisher)
- [PROMPT 61 — Checkpoint: Instagram publishing](#prompt-61--checkpoint-instagram-publishing)
- [PROMPT 62 — Facebook publisher](#prompt-62--facebook-publisher)
- [PROMPT 63 — Test Facebook publisher](#prompt-63--test-facebook-publisher)
- [PROMPT 64 — Checkpoint: Facebook publishing](#prompt-64--checkpoint-facebook-publishing)
- [PROMPT 65 — YouTube publisher (manual hold)](#prompt-65--youtube-publisher-manual-hold)
- [PROMPT 66 — Test YouTube publisher](#prompt-66--test-youtube-publisher)
- [PROMPT 67 — Checkpoint: YouTube publishing](#prompt-67--checkpoint-youtube-publishing)
- [PROMPT 68 — X publisher](#prompt-68--x-publisher)
- [PROMPT 69 — Test X publisher](#prompt-69--test-x-publisher)
- [PROMPT 70 — Checkpoint: X publishing](#prompt-70--checkpoint-x-publishing)
- [PROMPT 71 — TikTok publisher](#prompt-71--tiktok-publisher)
- [PROMPT 72 — Test TikTok publisher](#prompt-72--test-tiktok-publisher)
- [PROMPT 73 — Checkpoint: TikTok publishing](#prompt-73--checkpoint-tiktok-publishing)

### Phase 7 — OAuth Flows

- [PROMPT 74 — OAuth config](#prompt-74--oauth-config)
- [PROMPT 75 — PKCE helpers](#prompt-75--pkce-helpers)
- [PROMPT 76 — Test PKCE helpers](#prompt-76--test-pkce-helpers)
- [PROMPT 77 — Token manager (refresh)](#prompt-77--token-manager-refresh)
- [PROMPT 78 — Test token manager](#prompt-78--test-token-manager)
- [PROMPT 79 — OAuth start route](#prompt-79--oauth-start-route)
- [PROMPT 80 — OAuth callback route](#prompt-80--oauth-callback-route)
- [PROMPT 81 — Test OAuth callback](#prompt-81--test-oauth-callback)
- [PROMPT 82 — Connections API](#prompt-82--connections-api)
- [PROMPT 83 — Test connections API](#prompt-83--test-connections-api)
- [PROMPT 84 — Checkpoint: OAuth](#prompt-84--checkpoint-oauth)

### Phase 8 — Dashboard

- [PROMPT 85 — NextAuth options](#prompt-85--nextauth-options)
- [PROMPT 86 — NextAuth route handler](#prompt-86--nextauth-route-handler)
- [PROMPT 87 — Sign-in page](#prompt-87--sign-in-page)
- [PROMPT 88 — Dashboard layout + guard](#prompt-88--dashboard-layout--guard)
- [PROMPT 89 — GET /api/posts](#prompt-89--get-apiposts)
- [PROMPT 90 — GET /api/posts/[postId]](#prompt-90--get-apipostspostid)
- [PROMPT 91 — Test posts APIs](#prompt-91--test-posts-apis)
- [PROMPT 92 — Approve route](#prompt-92--approve-route)
- [PROMPT 93 — Reject route](#prompt-93--reject-route)
- [PROMPT 94 — Manual retry route](#prompt-94--manual-retry-route)
- [PROMPT 95 — Test approve/reject/retry](#prompt-95--test-approverejectretry)
- [PROMPT 96 — Auto-publish toggle route](#prompt-96--auto-publish-toggle-route)
- [PROMPT 97 — Test auto-publish toggle](#prompt-97--test-auto-publish-toggle)
- [PROMPT 98 — Status + list components](#prompt-98--status--list-components)
- [PROMPT 99 — Preview + retry components](#prompt-99--preview--retry-components)
- [PROMPT 100 — Connection components](#prompt-100--connection-components)
- [PROMPT 101 — Dashboard posts page](#prompt-101--dashboard-posts-page)
- [PROMPT 102 — Post detail page](#prompt-102--post-detail-page)
- [PROMPT 103 — Connections page](#prompt-103--connections-page)
- [PROMPT 104 — Checkpoint: Dashboard](#prompt-104--checkpoint-dashboard)

### Phase 9 — Queue and Retry Logic

- [PROMPT 105 — Backoff + jitter](#prompt-105--backoff--jitter)
- [PROMPT 106 — Test backoff](#prompt-106--test-backoff)
- [PROMPT 107 — Enqueue helper](#prompt-107--enqueue-helper)
- [PROMPT 108 — Process-one-job](#prompt-108--process-one-job)
- [PROMPT 109 — Test process-job](#prompt-109--test-process-job)
- [PROMPT 110 — Worker two-pass loop](#prompt-110--worker-two-pass-loop)
- [PROMPT 111 — Worker entrypoint](#prompt-111--worker-entrypoint)
- [PROMPT 112 — Cron-tick runner route](#prompt-112--cron-tick-runner-route)
- [PROMPT 113 — Checkpoint: Queue & Retry](#prompt-113--checkpoint-queue--retry)

### Phase 10 — Testing

- [PROMPT 114 — End-to-end pipeline test](#prompt-114--end-to-end-pipeline-test)
- [PROMPT 115 — Signature-rejection security test](#prompt-115--signature-rejection-security-test)
- [PROMPT 116 — Coverage matrix](#prompt-116--coverage-matrix)
- [PROMPT 117 — CI + coverage gate](#prompt-117--ci--coverage-gate)
- [PROMPT 118 — Checkpoint: Testing](#prompt-118--checkpoint-testing)

### Phase 11 — Deployment

- [PROMPT 119 — Dockerfiles](#prompt-119--dockerfiles)
- [PROMPT 120 — Compose config](#prompt-120--compose-config)
- [PROMPT 121 — Migration + startup script](#prompt-121--migration--startup-script)
- [PROMPT 122 — Secrets + deployment docs](#prompt-122--secrets--deployment-docs)
- [PROMPT 123 — README](#prompt-123--readme)
- [PROMPT 124 — Checkpoint: Deployable](#prompt-124--checkpoint-deployable)

---

# Phase 1 — Setup

## PROMPT 01 — Initialize Next.js + TypeScript strict project

Project: **WordPress Social Autopilot** (repo root `C:\MLSCampus\wordpress-social-autopilot`).
Initialize a **Next.js 16.2.9** App Router project using **TypeScript 6.0.3** in this existing repo.
Create/configure `package.json` (pin every dependency to the versions in
`specs/001-social-autopilot/research.md`: next 16.2.9, react/react-dom matching Next 16, typescript
6.0.3, zod 4.4.3, prisma 7.8.0 + @prisma/client, next-auth 4.24.14, tailwindcss 4.3.2,
@anthropic-ai/sdk 0.107.0, vitest) and `tsconfig.json` with `"strict": true`,
`"noUncheckedIndexedAccess": true`, path alias `@/* → src/*`. Use the `src/app/` directory layout
from `plan.md` (Project Structure). Do NOT scaffold demo pages.
📋 **Doc-check**: confirm the Next.js 16 App Router project layout and `create-next-app` flags
against the official Next.js 16 docs before finalizing config.

✅ After this step: a buildable Next.js 16 + TypeScript strict project skeleton (`package.json`,
`tsconfig.json`, `src/app/`).

## PROMPT 02 — Configure Tailwind CSS v4

Project: WordPress Social Autopilot. Configure **Tailwind CSS 4.3.2** (CSS-first, no
`tailwind.config.js`) for the Next.js App Router. Create `src/app/globals.css` with
`@import "tailwindcss";` and `postcss.config.mjs` wired for Tailwind v4. Import `globals.css` in the
root layout `src/app/layout.tsx`.
📋 **Doc-check**: Tailwind v4 setup differs from v3 — confirm the v4 + Next.js install steps against
the official Tailwind CSS v4 docs.

✅ After this step: Tailwind v4 styling works (`src/app/globals.css`, `postcss.config.mjs`).

## PROMPT 03 — Configure ESLint + Prettier

Project: WordPress Social Autopilot. Add **ESLint** (Next.js + TypeScript strict rules, ban
`any`) in `eslint.config.mjs` and **Prettier** in `.prettierrc`. Add `lint` and `format` scripts to
`package.json`. Rules must enforce constitution Principle I (no `any`, explicit types).

✅ After this step: lint/format tooling enforcing strict TS (`eslint.config.mjs`, `.prettierrc`).

## PROMPT 04 — Configure Vitest

Project: WordPress Social Autopilot. Configure **Vitest** in `vitest.config.ts` with the test root
at `tests/`, TypeScript support, and coverage reporting. Add `test` and `test:watch` scripts to
`package.json`. Tests live under `tests/unit/` and `tests/integration/` per `plan.md`.

✅ After this step: a working test runner (`vitest.config.ts`, `npm test` executes).

## PROMPT 05 — Zod environment loader

Project: WordPress Social Autopilot. Implement `src/lib/env.ts`: parse `process.env` through a
**Zod 4.4.3** schema at module load and export a typed `env` object; the process MUST throw on
invalid/missing values (constitution Principle II — env validated at startup, refuse to boot).
Include every variable from `plan.md` §9: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET,
APP_BASE_URL, WEBHOOK_SECRET, TOKEN_ENCRYPTION_KEY (32-byte base64), GITHUB_CLIENT_ID/SECRET,
OWNER_GITHUB_LOGIN, ANTHROPIC_API_KEY, NOVAMIRA_MCP_URL/_TOKEN, WORDPRESS_SITE_URL,
LINKEDIN_CLIENT_ID/SECRET, META_APP_ID/SECRET, X_CLIENT_ID/SECRET, TIKTOK_CLIENT_KEY/SECRET,
GOOGLE_CLIENT_ID/SECRET. No secrets logged.

✅ After this step: a startup-validated, typed env module (`src/lib/env.ts`).

## PROMPT 06 — Test environment schema

Project: WordPress Social Autopilot. Add `tests/unit/env.test.ts` (Vitest) covering `src/lib/env.ts`:
a complete valid env parses; a missing required var throws; an invalid `TOKEN_ENCRYPTION_KEY`
(wrong length/encoding) throws. Constitution Principle VII (Zod schemas need valid+invalid tests).

✅ After this step: passing env-schema tests (`tests/unit/env.test.ts`).

## PROMPT 07 — Create .env.example

Project: WordPress Social Autopilot. Create `.env.example` listing every variable from `src/lib/env.ts`
/ `plan.md` §9 with placeholder values and short comments (no real secrets). Group by Core,
Security, GitHub auth, Claude, NovaMira MCP, and each social platform.

✅ After this step: a documented env template (`.env.example`).

## PROMPT 08 — Checkpoint: Setup

Project: WordPress Social Autopilot. Validate Phase 1 Setup: run `npm run build`, `npm run lint`,
and `npm test`; confirm `src/lib/env.ts` throws when a required variable is absent. Report results
and fix any failures. Do not proceed until all pass.

✅ After this step: a verified, building project skeleton with passing setup tests.

---

# Phase 2 — Foundational

## PROMPT 09 — Prisma schema (all models)

Project: WordPress Social Autopilot. Using **Prisma 7.8.0** + PostgreSQL, write the full
`prisma/schema.prisma` exactly per `specs/001-social-autopilot/data-model.md`: enums (`Platform`,
`ContentStatus`, `JobStatus`, `AccountStatus`, `AuditOutcome`) and models **WordPressPost**
(incl. `generatedAt DateTime?`, `wpPostId @unique`), **GeneratedContent** (`@@unique([postId,
platform])`), **PublishJob** (`@@index([status, nextRunAt])`, `maxAttempts default 3`),
**PlatformAccount** (`platform @unique`, encrypted `accessToken`/`refreshToken`, `autoPublish`,
`fbPageId`, `igUserId`), and **AuditLog** (`@@index([contentId])`). Prisma is the single source of
truth (Principle V).
📋 **Doc-check**: confirm Prisma 7 schema/config conventions (datasource/generator blocks,
`prisma.config.ts` if applicable) against the official Prisma 7 docs.

✅ After this step: the complete data model (`prisma/schema.prisma`).

## PROMPT 10 — Initial migration

Project: WordPress Social Autopilot. Generate and apply the first migration for
`prisma/schema.prisma`: run `npx prisma migrate dev --name init` and `npx prisma generate`. Ensure
`DATABASE_URL` points to a reachable PostgreSQL. Commit the generated SQL under
`prisma/migrations/`.
📋 **Doc-check**: confirm the Prisma 7 migrate workflow against official docs if commands differ.

✅ After this step: an applied initial migration + generated client (`prisma/migrations/`).

## PROMPT 11 — Prisma client singleton

Project: WordPress Social Autopilot. Implement `src/lib/prisma.ts`: a singleton `@prisma/client`
instance (guard against hot-reload duplication in dev). All DB access goes through this. Principle V
(single source of truth).

✅ After this step: a shared Prisma client (`src/lib/prisma.ts`).

## PROMPT 12 — AES-256-GCM token crypto

Project: WordPress Social Autopilot. Implement `src/lib/crypto.ts` with `encrypt(plaintext)` /
`decrypt(ciphertext)` using **AES-256-GCM** (Node `crypto`), keyed by `env.TOKEN_ENCRYPTION_KEY`
(32-byte base64). Store iv + authTag + ciphertext together. Used to encrypt OAuth tokens at rest
(constitution Principle II, FR-018). Never log plaintext or key.

✅ After this step: token encryption helpers (`src/lib/crypto.ts`).

## PROMPT 13 — Test crypto round-trip

Project: WordPress Social Autopilot. Add `tests/unit/crypto.test.ts`: `decrypt(encrypt(x)) === x`
for various inputs; tampering with the ciphertext/authTag throws. Principle VII.

✅ After this step: passing crypto tests (`tests/unit/crypto.test.ts`).

## PROMPT 14 — Char limits + truncation

Project: WordPress Social Autopilot. Implement `src/lib/limits.ts`: a per-platform character-limit
map (LinkedIn 3000, Instagram 2200, Facebook 500-target, YouTube 5000, X 280, TikTok 2200 — per
`spec.md` FR-010) and `truncateToLimit(text, link, platform)` that **hard-truncates at a word
boundary while always preserving the post link** (FR-011 / clarification — truncate, never
regenerate).

✅ After this step: limit + truncation utility (`src/lib/limits.ts`).

## PROMPT 15 — Test truncation

Project: WordPress Social Autopilot. Add `tests/unit/limits.test.ts`: over-limit text is cut at a
word boundary and the link is still present and within the limit; under-limit text is unchanged;
the link is never truncated. Principle VII, FR-011.

✅ After this step: passing truncation tests (`tests/unit/limits.test.ts`).

## PROMPT 16 — Audit log writer

Project: WordPress Social Autopilot. Implement `src/lib/audit.ts`: `writeAudit({contentId,
platform, attempt, outcome, externalId?, errorContext?})` creating an `AuditLog` row via
`src/lib/prisma.ts`. `outcome` ∈ ATTEMPT/SUCCESS/FAILURE. **Strip secrets** from `errorContext`
(no tokens/signatures). Principle V (audit per attempt) + Principle II (no secret logging),
FR-027/FR-029.

✅ After this step: the audit writer (`src/lib/audit.ts`).

## PROMPT 17 — Test audit writer

Project: WordPress Social Autopilot. Add `tests/unit/audit.test.ts` (mock Prisma): records the
correct fields per outcome; asserts no secret-looking fields (token/secret/authorization) survive in
`errorContext`. Principle VII.

✅ After this step: passing audit tests (`tests/unit/audit.test.ts`).

## PROMPT 18 — Checkpoint: Foundation

Project: WordPress Social Autopilot. Validate Phase 2: `prisma migrate` applies cleanly; crypto,
limits, and audit tests pass. Fix any issues before proceeding.

✅ After this step: a verified foundation (DB + crypto + limits + audit) ready for features.

---

# Phase 3 — WordPress Integration

## PROMPT 19 — HMAC webhook verify

Project: WordPress Social Autopilot. Implement `src/lib/webhook/verify.ts`:
`verifySignature(rawBody, header)` computing **HMAC-SHA256** of the **raw request body** with
`env.WEBHOOK_SECRET` and comparing to the `X-WSA-Signature: sha256=<hex>` header using
`crypto.timingSafeEqual` (constant-time). Return boolean; reject on mismatch. Constitution Principle
II, FR-002, contracts/webhook.md.

✅ After this step: constant-time signature verification (`src/lib/webhook/verify.ts`).

## PROMPT 20 — Test signature verify

Project: WordPress Social Autopilot. Add `tests/unit/webhook/verify.test.ts`: valid signature
passes; wrong secret fails; tampered body fails; missing/malformed header fails. Principle VII,
SC-006.

✅ After this step: passing signature-verify tests (`tests/unit/webhook/verify.test.ts`).

## PROMPT 21 — WordPress payload schema

Project: WordPress Social Autopilot. Implement `src/lib/wordpress/schema.ts`: a **Zod 4.4.3** schema
for the webhook payload (`wpPostId`, `title`, `content`, `excerpt`, `featuredImageUrl` nullable,
`url`, `categories[]`, `tags[]`, `event`) plus a "required for generation" check identifying missing
fields that trigger backfill. FR-004, contracts/webhook.md. Zod at the boundary (Principle I).

✅ After this step: the WordPress payload schema (`src/lib/wordpress/schema.ts`).

## PROMPT 22 — Test WordPress schema

Project: WordPress Social Autopilot. Add `tests/unit/wordpress/schema.test.ts`: complete payload
parses; partial payload flags the missing fields; wrong types reject. Principle VII.

✅ After this step: passing WordPress-schema tests (`tests/unit/wordpress/schema.test.ts`).

## PROMPT 23 — NovaMira MCP fallback

Project: WordPress Social Autopilot. Implement `src/lib/wordpress/novamira.ts` exposing
`fetchFullPost({ wpPostId?, url? })`: invoke the **NovaMira MCP** tool (loaded on demand) to read the
full post from `env.WORDPRESS_SITE_URL` using `env.NOVAMIRA_MCP_URL`/`_TOKEN`, validate the response
with the `src/lib/wordpress/schema.ts` schema, and return the merged fields. On unretrievable post,
throw a typed error (caller marks the run failed; no partial publish). FR-005, plan §10.

✅ After this step: the NovaMira backfill module (`src/lib/wordpress/novamira.ts`).

## PROMPT 24 — Test NovaMira fallback

Project: WordPress Social Autopilot. Add `tests/unit/wordpress/novamira.test.ts` (mock the MCP call):
missing fields are backfilled and merged; an unretrievable post throws the typed error. Principle VII.

✅ After this step: passing NovaMira tests (`tests/unit/wordpress/novamira.test.ts`).

## PROMPT 25 — Webhook receiver route

Project: WordPress Social Autopilot. Implement `src/app/api/webhooks/wordpress/route.ts` (App Router
POST handler): read the **raw body**, call `verify.ts` (401 on mismatch), parse via
`wordpress/schema.ts`, backfill via `novamira.ts` if incomplete, **upsert `WordPressPost`** (dedupe on
`wpPostId`, `generatedAt = null`), and return **202** immediately. Do NOT create content rows or jobs
here (the worker's generation pass handles that). FR-001/002/003/006, contracts/webhook.md, plan §3.

✅ After this step: the non-blocking signed webhook receiver
(`src/app/api/webhooks/wordpress/route.ts`).

## PROMPT 26 — Webhook integration test

Project: WordPress Social Autopilot. Add `tests/integration/webhook.test.ts`: valid signature +
complete payload → 202 and a `WordPressPost` row with `generatedAt=null`; invalid/tampered/missing
signature → 401, nothing persisted; duplicate `wpPostId` → no duplicate row; incomplete payload →
NovaMira invoked (mocked); ACK returns < 2s with generation deferred. FR-002/003/006, SC-003/SC-006,
contracts/webhook.md.

✅ After this step: passing webhook integration tests (`tests/integration/webhook.test.ts`).

## PROMPT 27 — Checkpoint: WordPress ingestion

Project: WordPress Social Autopilot. Validate Phase 3 using `quickstart.md` Scenario B step 1: send a
signed test webhook → expect 202 and a persisted post; send an unsigned one → expect 401. Fix any
issues.

✅ After this step: verified WordPress ingestion (signed webhook persists a post; unsigned rejected).

---

# Phase 4 — Claude AI Integration

## PROMPT 28 — Anthropic client + model constant

Project: WordPress Social Autopilot. Implement `src/lib/ai/client.ts` using **@anthropic-ai/sdk
0.107.0**: construct the client from `env.ANTHROPIC_API_KEY` and export `MODEL = "claude-opus-4-8"`.
Standardize on adaptive thinking (`thinking: { type: "adaptive" }`) — never use `budget_tokens`.
Constitution Principle IV.
📋 **Doc-check**: confirm `@anthropic-ai/sdk` 0.107.0 client init, `messages.parse`, the
`zodOutputFormat` helper (`@anthropic-ai/sdk/helpers/zod`), and adaptive thinking on
`claude-opus-4-8` against the Anthropic SDK docs / the claude-api skill before use.

✅ After this step: the Anthropic client + model constant (`src/lib/ai/client.ts`).

## PROMPT 29 — Per-platform output schemas

Project: WordPress Social Autopilot. Implement `src/lib/ai/schemas.ts`: a **Zod** schema per platform
for Claude's structured output `{ body: string, hashtags: string[] }`, enforcing each platform's
hashtag-count bounds from `spec.md` FR-010 (LinkedIn 3–5, Instagram 10–15, Facebook 2–3, YouTube
flexible, X 1–2, TikTok 3–5). These drive `messages.parse` validation. Principle IV (validate every
Claude response).

✅ After this step: per-platform AI output schemas (`src/lib/ai/schemas.ts`).

## PROMPT 30 — Test output schemas

Project: WordPress Social Autopilot. Add `tests/unit/ai/schemas.test.ts`: valid `{body,hashtags}`
per platform passes; malformed/missing/too-many-hashtags rejects. Principle VII (incl.
malformed-response handling).

✅ After this step: passing AI-schema tests (`tests/unit/ai/schemas.test.ts`).

## PROMPT 31 — Checkpoint: AI scaffolding

Project: WordPress Social Autopilot. Validate Phase 4: schemas import cleanly, schema tests pass, and
`src/lib/ai/client.ts` constructs with a mocked/test API key. Fix any issues.

✅ After this step: verified Claude AI scaffolding ready for prompt modules.

---

# Phase 5 — Per-Platform Content Generation

> Each platform gets a version-controlled prompt constant (Principle IV) plus a mocked-Claude
> generation test. Rules come from `spec.md` FR-010. Every prompt MUST instruct Claude to include a
> direct backlink to the WordPress post (FR-009) and stay within the platform character limit.

## PROMPT 32 — LinkedIn prompt constant

Project: WordPress Social Autopilot. Implement `src/lib/ai/prompts/linkedin.ts` exporting a named
constant prompt (system + instructions) for LinkedIn per FR-010: **professional tone, ≤3000
characters, 3–5 relevant hashtags, include the post link with a call to action**, content relevant to
the specific post (not a generic summary, FR-008). Output must match the LinkedIn schema from
`src/lib/ai/schemas.ts`. Prompt is a constant, never inline (Principle IV).

✅ After this step: the LinkedIn prompt constant (`src/lib/ai/prompts/linkedin.ts`).

## PROMPT 33 — Test LinkedIn generation

Project: WordPress Social Autopilot. Add `tests/unit/ai/generate-linkedin.test.ts`: with a **mocked**
Claude response, the LinkedIn prompt path yields schema-valid `{body,hashtags}`, within 3000 chars,
containing the post link. Principle VII.

✅ After this step: passing LinkedIn generation test (`tests/unit/ai/generate-linkedin.test.ts`).

## PROMPT 34 — Checkpoint: LinkedIn content

Project: WordPress Social Autopilot. Confirm the LinkedIn prompt produces schema-valid copy with a
backlink under 3000 chars (mocked). Fix issues before the next platform.

✅ After this step: verified LinkedIn content generation.

## PROMPT 35 — Instagram prompt constant

Project: WordPress Social Autopilot. Implement `src/lib/ai/prompts/instagram.ts`: Instagram prompt per
FR-010 — **visual-first tone, ≤2200 characters, 10–15 hashtags, strong hook in the first line, post
link included as a caption note (links are not clickable)**, relevant to the post. Matches the
Instagram schema. Constant only.

✅ After this step: the Instagram prompt constant (`src/lib/ai/prompts/instagram.ts`).

## PROMPT 36 — Test Instagram generation

Project: WordPress Social Autopilot. Add `tests/unit/ai/generate-instagram.test.ts` (mocked Claude):
schema-valid, ≤2200 chars, 10–15 hashtags, link present in caption note. Principle VII.

✅ After this step: passing Instagram generation test (`tests/unit/ai/generate-instagram.test.ts`).

## PROMPT 37 — Checkpoint: Instagram content

Project: WordPress Social Autopilot. Confirm Instagram prompt valid (mocked). Fix issues.

✅ After this step: verified Instagram content generation.

## PROMPT 38 — Facebook prompt constant

Project: WordPress Social Autopilot. Implement `src/lib/ai/prompts/facebook.ts`: Facebook prompt per
FR-010 — **conversational tone, kept under 500 characters for engagement, 2–3 hashtags, include a
clickable post link**, relevant to the post. Matches the Facebook schema. Constant only.

✅ After this step: the Facebook prompt constant (`src/lib/ai/prompts/facebook.ts`).

## PROMPT 39 — Test Facebook generation

Project: WordPress Social Autopilot. Add `tests/unit/ai/generate-facebook.test.ts` (mocked Claude):
schema-valid, under-500-char target, clickable link present. Principle VII.

✅ After this step: passing Facebook generation test (`tests/unit/ai/generate-facebook.test.ts`).

## PROMPT 40 — Checkpoint: Facebook content

Project: WordPress Social Autopilot. Confirm Facebook prompt valid (mocked). Fix issues.

✅ After this step: verified Facebook content generation.

## PROMPT 41 — YouTube prompt constant

Project: WordPress Social Autopilot. Implement `src/lib/ai/prompts/youtube.ts`: YouTube prompt per
FR-010 — **community post / video description, ≤5000 characters, timestamps where relevant, include
the post link**, relevant to the post. Note: YouTube content will be held as `MANUAL_REQUIRED` (no
public community-post API — research.md), so this copy is for the owner to post manually. Constant
only.

✅ After this step: the YouTube prompt constant (`src/lib/ai/prompts/youtube.ts`).

## PROMPT 42 — Test YouTube generation

Project: WordPress Social Autopilot. Add `tests/unit/ai/generate-youtube.test.ts` (mocked Claude):
schema-valid, ≤5000 chars, link present. Principle VII.

✅ After this step: passing YouTube generation test (`tests/unit/ai/generate-youtube.test.ts`).

## PROMPT 43 — Checkpoint: YouTube content

Project: WordPress Social Autopilot. Confirm YouTube prompt valid (mocked); content destined for
`MANUAL_REQUIRED`. Fix issues.

✅ After this step: verified YouTube content generation (manual-hold copy).

## PROMPT 44 — X prompt constant

Project: WordPress Social Autopilot. Implement `src/lib/ai/prompts/x.ts`: X/Twitter prompt per FR-010
— **punchy and direct, ≤280 characters, 1–2 hashtags, include a shortened post link**, relevant to
the post. Matches the X schema. Constant only.

✅ After this step: the X prompt constant (`src/lib/ai/prompts/x.ts`).

## PROMPT 45 — Test X generation

Project: WordPress Social Autopilot. Add `tests/unit/ai/generate-x.test.ts` (mocked Claude):
schema-valid, **strictly ≤280 chars including the link**, 1–2 hashtags. Principle VII.

✅ After this step: passing X generation test (`tests/unit/ai/generate-x.test.ts`).

## PROMPT 46 — Checkpoint: X content

Project: WordPress Social Autopilot. Confirm X prompt valid and within 280 chars (mocked). Fix issues.

✅ After this step: verified X content generation within the 280-char limit.

## PROMPT 47 — TikTok prompt constant

Project: WordPress Social Autopilot. Implement `src/lib/ai/prompts/tiktok.ts`: TikTok prompt per
FR-010 — **trendy and engaging tone, ≤2200 characters, 3–5 hashtags, hook in the first line, post
link included as a bio note**, relevant to the post. Constant only.

✅ After this step: the TikTok prompt constant (`src/lib/ai/prompts/tiktok.ts`).

## PROMPT 48 — Test TikTok generation

Project: WordPress Social Autopilot. Add `tests/unit/ai/generate-tiktok.test.ts` (mocked Claude):
schema-valid, ≤2200 chars, 3–5 hashtags, link as bio note. Principle VII.

✅ After this step: passing TikTok generation test (`tests/unit/ai/generate-tiktok.test.ts`).

## PROMPT 49 — Checkpoint: TikTok content

Project: WordPress Social Autopilot. Confirm TikTok prompt valid (mocked). Fix issues.

✅ After this step: verified TikTok content generation.

## PROMPT 50 — Prompt registry

Project: WordPress Social Autopilot. Implement `src/lib/ai/prompts/index.ts`: a registry mapping each
`Platform` to its prompt constant (linkedin, instagram, facebook, youtube, x, tiktok). Used by the
generation orchestrator. Principle IV.

✅ After this step: the platform→prompt registry (`src/lib/ai/prompts/index.ts`).

## PROMPT 51 — generateForPost orchestrator

Project: WordPress Social Autopilot. Implement `src/lib/ai/generate.ts` exporting
`generateForPost(post)`. For each of the six platforms: call `client.messages.parse({ model: MODEL,
output_config: { format: zodOutputFormat(schema) }, thinking: { type: "adaptive" }, ... })` using the
platform prompt + post data, validate output, append the backlink (FR-009), run
`limits.truncateToLimit` (FR-011), and **create** the `GeneratedContent` row. Set status:
auto-publish + connected → `APPROVED` and enqueue a PublishJob (via `src/lib/queue/enqueue.ts`);
manual-approval → `PENDING`; unusable/empty output → `FAILED` with a reason; YouTube → `MANUAL_REQUIRED`;
Instagram with no `featuredImageUrl` / TikTok pre-audit → `MANUAL_REQUIRED`. Isolate per-platform
failures with `Promise.allSettled` (FR-016/FR-030). Stamp `WordPressPost.generatedAt = now` after all
six. Plan §4.
📋 **Doc-check**: re-confirm `messages.parse` + `zodOutputFormat` usage in @anthropic-ai/sdk 0.107.0.

✅ After this step: the content-generation orchestrator (`src/lib/ai/generate.ts`).

## PROMPT 52 — Test generateForPost

Project: WordPress Social Autopilot. Add `tests/unit/ai/generate.test.ts` (mock Claude + Prisma): all
six items created and schema-valid with backlinks within limits; a **malformed** response for one
platform → that platform `FAILED` while the others succeed (FR-016/FR-030); YouTube →
`MANUAL_REQUIRED`. Principle VII.

✅ After this step: passing orchestrator tests (`tests/unit/ai/generate.test.ts`).

## PROMPT 53 — Checkpoint: Content generation

Project: WordPress Social Autopilot. Validate Phase 5 against `quickstart.md` Scenario B step 2 and
SC-001/SC-002: generation yields six platform items, each with a working backlink and within its
character limit; one platform failing doesn't block the others. Fix issues.

✅ After this step: verified end-to-end content generation for all six platforms.

---

# Phase 6 — Per-Platform Publishing

> Each publisher is an isolated module behind a shared interface (Principle III) using native
> `fetch`, handling rate limits, token expiry→refresh→retry, and failure. Tests use mocked `fetch`
> and mocked tokens — no live network (Principle III/VII). Endpoint/version facts are in
> `research.md`.

## PROMPT 54 — Publisher interface + types

Project: WordPress Social Autopilot. Implement `src/lib/publishers/types.ts`: the `Publisher`
interface `{ platform, capabilities: { autoPublish, requiresMedia }, publish(content, account):
Promise<PublishResult> }` and `PublishResult = { ok: true; externalId? } | { ok: false; retryable:
boolean; error: string }` (error must be **secret-free**). Plan §5.

✅ After this step: publisher contract types (`src/lib/publishers/types.ts`).

## PROMPT 55 — Publisher registry

Project: WordPress Social Autopilot. Implement `src/lib/publishers/index.ts`: a
`Record<Platform, Publisher>` registry importing the six platform publishers (added next). Used by the
queue worker. Principle III.

✅ After this step: the publisher registry (`src/lib/publishers/index.ts`).

## PROMPT 56 — LinkedIn publisher

Project: WordPress Social Autopilot. Implement `src/lib/publishers/linkedin.ts` per `research.md`:
`POST https://api.linkedin.com/rest/posts` with headers `Authorization: Bearer`,
`LinkedIn-Version: 202606`, `X-Restli-Protocol-Version: 2.0.0`; body = `commentary` + a
`content.article` object (url/title/description). `capabilities: { autoPublish: true, requiresMedia:
false }`. Handle 429 (retryable) and token expiry (refresh via `src/lib/oauth/tokens.ts`, retry once).
Map to `PublishResult`. FR-010 / Principle III.
📋 **Doc-check**: confirm the LinkedIn `/rest/posts` body shape and current `LinkedIn-Version`
against the official LinkedIn Marketing API docs.

✅ After this step: the LinkedIn publisher (`src/lib/publishers/linkedin.ts`).

## PROMPT 57 — Test LinkedIn publisher

Project: WordPress Social Autopilot. Add `tests/unit/publishers/linkedin.test.ts` (mocked `fetch` +
tokens): cover **success, 429 rate-limit (retryable), token-expiry→refresh→retry, and permanent
failure**. Principle VII (required publisher test cases).

✅ After this step: passing LinkedIn publisher tests (`tests/unit/publishers/linkedin.test.ts`).

## PROMPT 58 — Checkpoint: LinkedIn publishing

Project: WordPress Social Autopilot. Confirm the LinkedIn publish path verified via mocked tests
(success + all failure modes). Fix issues.

✅ After this step: verified LinkedIn publishing module.

## PROMPT 59 — Instagram publisher

Project: WordPress Social Autopilot. Implement `src/lib/publishers/instagram.ts` per `research.md`:
**Instagram Graph API two-step container flow** on `https://graph.facebook.com/v25.0` — `POST
/{ig-user-id}/media` (with `image_url` = post `featuredImageUrl` + `caption`) then `POST
/{ig-user-id}/media_publish` (with `creation_id`). `capabilities: { autoPublish: true, requiresMedia:
true }`. If the post has **no featured image**, return a non-retryable result the worker maps to
`MANUAL_REQUIRED`. Respect the 25-posts/24h limit. FR-017.
📋 **Doc-check**: confirm Graph API version (currently v25.0), the container endpoints, and required
scopes against the official Meta/Instagram Platform docs.

✅ After this step: the Instagram publisher (`src/lib/publishers/instagram.ts`).

## PROMPT 60 — Test Instagram publisher

Project: WordPress Social Autopilot. Add `tests/unit/publishers/instagram.test.ts` (mocked `fetch`):
two-step container success; **no-media skip** (non-retryable); rate-limit (25/24h) handling; permanent
failure. Principle VII.

✅ After this step: passing Instagram publisher tests (`tests/unit/publishers/instagram.test.ts`).

## PROMPT 61 — Checkpoint: Instagram publishing

Project: WordPress Social Autopilot. Confirm the Instagram container publish path verified (mocked),
including the no-media path. Fix issues.

✅ After this step: verified Instagram publishing module.

## PROMPT 62 — Facebook publisher

Project: WordPress Social Autopilot. Implement `src/lib/publishers/facebook.ts` per `research.md`:
`POST https://graph.facebook.com/v25.0/{page-id}/feed` with a **Page access token**, body `message`

- `link` (clickable). `capabilities: { autoPublish: true, requiresMedia: false }`. Handle 429 and
  failures. FR-010.
  📋 **Doc-check**: confirm `/{page-id}/feed` params, Page-token requirement, and `pages_manage_posts`
  scope against the official Meta Graph API / Pages API docs.

✅ After this step: the Facebook publisher (`src/lib/publishers/facebook.ts`).

## PROMPT 63 — Test Facebook publisher

Project: WordPress Social Autopilot. Add `tests/unit/publishers/facebook.test.ts` (mocked `fetch`):
success, 429 rate-limit, permanent failure. Principle VII.

✅ After this step: passing Facebook publisher tests (`tests/unit/publishers/facebook.test.ts`).

## PROMPT 64 — Checkpoint: Facebook publishing

Project: WordPress Social Autopilot. Confirm the Facebook publish path verified (mocked). Fix issues.

✅ After this step: verified Facebook publishing module.

## PROMPT 65 — YouTube publisher (manual hold)

Project: WordPress Social Autopilot. Implement `src/lib/publishers/youtube.ts` per `research.md`: the
public **YouTube Data API v3 has no endpoint to create community posts**, so `capabilities: {
autoPublish: false, requiresMedia: false }` and `publish()` returns a **non-retryable** result the
worker maps to `MANUAL_REQUIRED` (no `fetch` call). Matches the spec YouTube edge case.

✅ After this step: the YouTube manual-hold publisher (`src/lib/publishers/youtube.ts`).

## PROMPT 66 — Test YouTube publisher

Project: WordPress Social Autopilot. Add `tests/unit/publishers/youtube.test.ts`: `publish()` always
returns the non-retryable manual-required result and makes **no** network call. Principle VII.

✅ After this step: passing YouTube publisher tests (`tests/unit/publishers/youtube.test.ts`).

## PROMPT 67 — Checkpoint: YouTube publishing

Project: WordPress Social Autopilot. Confirm YouTube correctly holds for manual posting (no API call).
Fix issues.

✅ After this step: verified YouTube manual-hold behavior.

## PROMPT 68 — X publisher

Project: WordPress Social Autopilot. Implement `src/lib/publishers/x.ts` per `research.md`: `POST
https://api.x.com/2/tweets` with an OAuth2 bearer token, body `{ text }` (≤280 chars, includes the
shortened link). `capabilities: { autoPublish: true, requiresMedia: false }`. Handle token expiry
(refresh + rotate via `src/lib/oauth/tokens.ts`), 429, and failure. Note: X is pay-per-use (cost
documented in research.md) — an account concern, not a code change. FR-010.
📋 **Doc-check**: confirm `POST /2/tweets`, required scopes, and host against the official X API v2
docs.

✅ After this step: the X publisher (`src/lib/publishers/x.ts`).

## PROMPT 69 — Test X publisher

Project: WordPress Social Autopilot. Add `tests/unit/publishers/x.test.ts` (mocked `fetch`): success;
**token-expiry → refresh (rotating refresh token persisted) → retry**; 429; permanent failure.
Principle VII.

✅ After this step: passing X publisher tests (`tests/unit/publishers/x.test.ts`).

## PROMPT 70 — Checkpoint: X publishing

Project: WordPress Social Autopilot. Confirm the X publish path verified (mocked), including refresh
rotation. Fix issues.

✅ After this step: verified X publishing module.

## PROMPT 71 — TikTok publisher

Project: WordPress Social Autopilot. Implement `src/lib/publishers/tiktok.ts` per `research.md`:
TikTok Content Posting API v2 on `https://open.tiktokapis.com/v2/post/publish/` using the **inbox/draft
flow** (`content/init/`) until the app is audited; `capabilities: { autoPublish: true (queues to
drafts), requiresMedia: true }` (uses post `featuredImageUrl` as a photo). No-media → non-retryable →
`MANUAL_REQUIRED`. Handle token refresh (rotating) and failure. FR-010.
📋 **Doc-check**: confirm the TikTok `content/init/` flow, audit/visibility rules, and scopes against
the official TikTok Content Posting API docs.

✅ After this step: the TikTok publisher (`src/lib/publishers/tiktok.ts`).

## PROMPT 72 — Test TikTok publisher

Project: WordPress Social Autopilot. Add `tests/unit/publishers/tiktok.test.ts` (mocked `fetch`):
draft-flow success; no-media skip; failure. Principle VII.

✅ After this step: passing TikTok publisher tests (`tests/unit/publishers/tiktok.test.ts`).

## PROMPT 73 — Checkpoint: TikTok publishing

Project: WordPress Social Autopilot. Confirm the TikTok draft publish path verified (mocked) and all
six publishers are registered in `src/lib/publishers/index.ts`. Fix issues.

✅ After this step: verified TikTok publishing module + complete publisher registry.

---

# Phase 7 — OAuth Flows

## PROMPT 74 — OAuth config

Project: WordPress Social Autopilot. Implement `src/lib/oauth/config.ts`: per-platform `{ authUrl,
tokenUrl, scopes, usesPkce }` for LinkedIn, Meta (Facebook+Instagram), X, TikTok, Google/YouTube,
using the URLs and scopes confirmed in `research.md` (e.g., LinkedIn `w_member_social`; X
`tweet.read tweet.write users.read offline.access` with PKCE; TikTok `video.publish`/`video.upload`).
FR-017.
📋 **Doc-check**: re-verify each platform's authorize/token URLs and scopes against official docs;
these change over time.

✅ After this step: per-platform OAuth configuration (`src/lib/oauth/config.ts`).

## PROMPT 75 — PKCE helpers

Project: WordPress Social Autopilot. Implement `src/lib/oauth/pkce.ts`: generate a PKCE
`code_verifier` and S256 `code_challenge` (used by X's OAuth2 Authorization Code + PKCE flow).
FR-017.

✅ After this step: PKCE helpers (`src/lib/oauth/pkce.ts`).

## PROMPT 76 — Test PKCE helpers

Project: WordPress Social Autopilot. Add `tests/unit/oauth/pkce.test.ts`: verifier/challenge generated
correctly (S256), challenge derives from verifier. Principle VII.

✅ After this step: passing PKCE tests (`tests/unit/oauth/pkce.test.ts`).

## PROMPT 77 — Token manager (refresh)

Project: WordPress Social Autopilot. Implement `src/lib/oauth/tokens.ts`:
`getValidAccessToken(platform)` reads the `PlatformAccount`, **decrypts** the token via
`src/lib/crypto.ts`; if expired/near-expiry and refresh is supported, POSTs the refresh grant,
**re-encrypts and persists the rotated refresh token** (X/TikTok rotate), returns a fresh token. If
refresh is unsupported/fails, set the account `status = TOKEN_EXPIRED` and surface a reconnect need.
Never log tokens. FR-019/FR-020, plan §6.

✅ After this step: the token manager with refresh/rotation (`src/lib/oauth/tokens.ts`).

## PROMPT 78 — Test token manager

Project: WordPress Social Autopilot. Add `tests/unit/oauth/tokens.test.ts` (mock fetch + Prisma):
valid token passthrough; refresh path persists the **rotated** refresh token; refresh failure sets
`TOKEN_EXPIRED`. Principle VII.

✅ After this step: passing token-manager tests (`tests/unit/oauth/tokens.test.ts`).

## PROMPT 79 — OAuth start route

Project: WordPress Social Autopilot. Implement `src/app/api/oauth/[platform]/start/route.ts` (GET,
owner-session required): generate a `state` CSRF cookie; for X generate a PKCE verifier (store in a
secure cookie) + challenge; redirect (302) to the provider's authorize URL with the platform's scopes
from `src/lib/oauth/config.ts`. FR-017, contracts/oauth.md.

✅ After this step: the OAuth start route (`src/app/api/oauth/[platform]/start/route.ts`).

## PROMPT 80 — OAuth callback route

Project: WordPress Social Autopilot. Implement `src/app/api/oauth/[platform]/callback/route.ts` (GET):
validate `state`; exchange `code` at the token URL (PKCE verifier for X); for Meta exchange the
short-lived token for a long-lived one and resolve `fbPageId`/`igUserId`; **encrypt** tokens and
upsert the `PlatformAccount` with `status = CONNECTED`, `expiresAt`, `scope`; redirect to
`/connections`. Errors → `/connections?error=...` (no secrets). FR-017/FR-018, contracts/oauth.md.
📋 **Doc-check**: confirm the Meta long-lived token exchange and page/IG-id lookup endpoints.

✅ After this step: the OAuth callback route storing encrypted tokens
(`src/app/api/oauth/[platform]/callback/route.ts`).

## PROMPT 81 — Test OAuth callback

Project: WordPress Social Autopilot. Add `tests/integration/oauth-callback.test.ts` (mock token
exchange): on success the tokens are stored **encrypted** and `status=CONNECTED`; invalid `state` → 400. Principle VII, FR-018.

✅ After this step: passing OAuth callback tests (`tests/integration/oauth-callback.test.ts`).

## PROMPT 82 — Connections API

Project: WordPress Social Autopilot. Implement `src/app/api/connections/route.ts`: `GET` returns each
platform's `{ platform, status, expiresAt, autoPublish }` (**never token material**); `DELETE
?platform=<P>` purges stored tokens and sets `status = DISCONNECTED`. Owner-session required.
FR-020/FR-021, contracts/oauth.md.

✅ After this step: the connections API (`src/app/api/connections/route.ts`).

## PROMPT 83 — Test connections API

Project: WordPress Social Autopilot. Add `tests/integration/connections.test.ts`: GET never includes
tokens; DELETE purges tokens and flips to `DISCONNECTED`; unauthenticated → 401. Principle VII.

✅ After this step: passing connections-API tests (`tests/integration/connections.test.ts`).

## PROMPT 84 — Checkpoint: OAuth

Project: WordPress Social Autopilot. Validate Phase 7 against `quickstart.md` Scenarios A & G (mocked
exchange): connect a platform → `CONNECTED` with an **encrypted** token; simulate expiry → `TOKEN_EXPIRED`
alert; disconnect → `DISCONNECTED`. Fix issues.

✅ After this step: verified OAuth connect/refresh/disconnect with encrypted tokens.

---

# Phase 8 — Dashboard

## PROMPT 85 — NextAuth options

Project: WordPress Social Autopilot. Implement `src/lib/auth.ts` using **NextAuth.js 4.24.14**: GitHub
provider (`env.GITHUB_CLIENT_ID/SECRET`), JWT session strategy, and a `signIn` callback that
**allowlists only `env.OWNER_GITHUB_LOGIN`** (single-owner dashboard). FR-022.
📋 **Doc-check**: confirm the NextAuth v4 GitHub provider + callback config against the official
NextAuth v4 docs.

✅ After this step: NextAuth options restricted to the owner (`src/lib/auth.ts`).

## PROMPT 86 — NextAuth route handler

Project: WordPress Social Autopilot. Implement `src/app/api/auth/[...nextauth]/route.ts`: the App
Router handler exporting `{ GET, POST }` from `NextAuth(authOptions)` (from `src/lib/auth.ts`).
📋 **Doc-check**: confirm the NextAuth v4 App Router route-handler pattern against official docs.

✅ After this step: the NextAuth route handler (`src/app/api/auth/[...nextauth]/route.ts`).

## PROMPT 87 — Sign-in page

Project: WordPress Social Autopilot. Implement `src/app/(auth)/signin/page.tsx`: a minimal
Tailwind-styled page with a "Sign in with GitHub" button invoking NextAuth. FR-022.

✅ After this step: the sign-in page (`src/app/(auth)/signin/page.tsx`).

## PROMPT 88 — Dashboard layout + guard

Project: WordPress Social Autopilot. Implement `src/app/(dashboard)/layout.tsx`: a server-side auth
guard that redirects unauthenticated users to `/signin`, plus a sidebar (Dashboard / Connections).
Wraps all dashboard pages. FR-022.

✅ After this step: the auth-guarded dashboard shell (`src/app/(dashboard)/layout.tsx`).

## PROMPT 89 — GET /api/posts

Project: WordPress Social Autopilot. Implement `src/app/api/posts/route.ts` (GET, owner-session): return
the list of triggering posts each with per-platform `{ platform, contentId, status }`. FR-022/FR-024,
contracts/dashboard-api.md.

✅ After this step: the posts-list API (`src/app/api/posts/route.ts`).

## PROMPT 90 — GET /api/posts/[postId]

Project: WordPress Social Autopilot. Implement `src/app/api/posts/[postId]/route.ts` (GET): return one
post plus its six `GeneratedContent` previews (`platform, status, body, hashtags, link, charCount`).
FR-023, contracts/dashboard-api.md.

✅ After this step: the post-detail API (`src/app/api/posts/[postId]/route.ts`).

## PROMPT 91 — Test posts APIs

Project: WordPress Social Autopilot. Add `tests/integration/posts-api.test.ts`: list/detail return
correct per-platform statuses; both 401 without an owner session. Principle VII.

✅ After this step: passing posts-API tests (`tests/integration/posts-api.test.ts`).

## PROMPT 92 — Approve route

Project: WordPress Social Autopilot. Implement `src/app/api/content/[contentId]/approve/route.ts`
(POST, owner-session): a `PENDING` item → `APPROVED` and enqueue a `PublishJob` via
`src/lib/queue/enqueue.ts`; non-PENDING → 409. FR-015, contracts/dashboard-api.md.

✅ After this step: the approve action (`src/app/api/content/[contentId]/approve/route.ts`).

## PROMPT 93 — Reject route

Project: WordPress Social Autopilot. Implement `src/app/api/content/[contentId]/reject/route.ts`
(POST): set status `REJECTED`; it MUST never publish. FR-015.

✅ After this step: the reject action (`src/app/api/content/[contentId]/reject/route.ts`).

## PROMPT 94 — Manual retry route

Project: WordPress Social Autopilot. Implement `src/app/api/content/[contentId]/retry/route.ts`
(POST): for a `FAILED` item, reset the `PublishJob` `attempts`/`nextRunAt` and re-queue; non-FAILED → 409. FR-026, contracts/dashboard-api.md.

✅ After this step: the manual-retry action (`src/app/api/content/[contentId]/retry/route.ts`).

## PROMPT 95 — Test approve/reject/retry

Project: WordPress Social Autopilot. Add `tests/integration/content-actions.test.ts`: approve enqueues

- flips status; reject never enqueues; retry only from FAILED (else 409); all 401 unauthenticated.
  Principle VII.

✅ After this step: passing content-action tests (`tests/integration/content-actions.test.ts`).

## PROMPT 96 — Auto-publish toggle route

Project: WordPress Social Autopilot. Implement `src/app/api/settings/auto-publish/route.ts` (PATCH,
owner-session): body `{ platform, autoPublish }` updates that platform's `PlatformAccount.autoPublish`
independently. FR-025, contracts/dashboard-api.md.

✅ After this step: the auto-publish toggle API (`src/app/api/settings/auto-publish/route.ts`).

## PROMPT 97 — Test auto-publish toggle

Project: WordPress Social Autopilot. Add `tests/integration/auto-publish.test.ts`: toggling one
platform persists and does not affect others; 401 unauthenticated. Principle VII, FR-025.

✅ After this step: passing toggle tests (`tests/integration/auto-publish.test.ts`).

## PROMPT 98 — Status + list components

Project: WordPress Social Autopilot. Implement `src/components/StatusBadge.tsx` (pending/approved/
published/failed/rejected/manual_required), `src/components/PostList.tsx`, and
`src/components/PostRow.tsx` (Tailwind). FR-024.

✅ After this step: status + post-list components (`src/components/StatusBadge.tsx`, `PostList.tsx`,
`PostRow.tsx`).

## PROMPT 99 — Preview + retry components

Project: WordPress Social Autopilot. Implement `src/components/PlatformPreviewCard.tsx` (shows
body+hashtags+link and Approve/Reject buttons calling the content routes when `PENDING`) and
`src/components/RetryButton.tsx` (calls the retry route when `FAILED`). FR-023/FR-015/FR-026.

✅ After this step: preview + retry components (`src/components/PlatformPreviewCard.tsx`,
`RetryButton.tsx`).

## PROMPT 100 — Connection components

Project: WordPress Social Autopilot. Implement `src/components/ConnectionCard.tsx`,
`src/components/ConnectionStatus.tsx` (connected/token-expired/disconnected), and
`src/components/AutoPublishToggle.tsx` (PATCH the toggle route). FR-020/FR-025.

✅ After this step: connection-management components (`src/components/ConnectionCard.tsx`,
`ConnectionStatus.tsx`, `AutoPublishToggle.tsx`).

## PROMPT 101 — Dashboard posts page

Project: WordPress Social Autopilot. Implement `src/app/(dashboard)/dashboard/page.tsx`: a Server
Component listing triggering posts via `PostList`, with a client component polling `/api/posts` so
status transitions appear without a manual refresh (real-time per Principle VI / FR-024).

✅ After this step: the dashboard posts page (`src/app/(dashboard)/dashboard/page.tsx`).

## PROMPT 102 — Post detail page

Project: WordPress Social Autopilot. Implement `src/app/(dashboard)/posts/[postId]/page.tsx`: render
the six `PlatformPreviewCard`s for the post (preview + approve/reject + status + retry). FR-023.

✅ After this step: the post-detail page (`src/app/(dashboard)/posts/[postId]/page.tsx`).

## PROMPT 103 — Connections page

Project: WordPress Social Autopilot. Implement `src/app/(dashboard)/connections/page.tsx`: render six
`ConnectionCard`s (status, Connect/Disconnect via the OAuth routes, AutoPublishToggle). FR-020/FR-021/
FR-025.

✅ After this step: the connections page (`src/app/(dashboard)/connections/page.tsx`).

## PROMPT 104 — Checkpoint: Dashboard

Project: WordPress Social Autopilot. Validate Phase 8 against `quickstart.md` Scenarios C & E (partial):
sign in as the owner; preview a pending item → approve → published; reject another; a failed item shows
Retry; an expired token shows a reconnect alert. Fix issues.

✅ After this step: a verified, authenticated dashboard (preview/approve/reject/status/retry/connections).

---

# Phase 9 — Queue and Retry Logic

## PROMPT 105 — Backoff + jitter

Project: WordPress Social Autopilot. Implement `src/lib/queue/backoff.ts`: `backoff(attempt)` =
`base * 2^attempt` with **full jitter** (e.g., base 2s → ~2s/4s/8s ± jitter). Up to 3 retries.
FR-028.

✅ After this step: the backoff calculator (`src/lib/queue/backoff.ts`).

## PROMPT 106 — Test backoff

Project: WordPress Social Autopilot. Add `tests/unit/queue/backoff.test.ts`: the delay grows
exponentially and stays within the jitter bounds for each attempt. Principle VII.

✅ After this step: passing backoff tests (`tests/unit/queue/backoff.test.ts`).

## PROMPT 107 — Enqueue helper

Project: WordPress Social Autopilot. Implement `src/lib/queue/enqueue.ts`:
`enqueuePublish(contentId)` creating a `PublishJob (QUEUED, attempts=0, nextRunAt=now)` via Prisma.
Called by the generation orchestrator (auto-publish) and the approve route. Plan §8.

✅ After this step: the enqueue helper (`src/lib/queue/enqueue.ts`).

## PROMPT 108 — Process-one-job

Project: WordPress Social Autopilot. Implement `src/lib/queue/process-job.ts`: given a `PublishJob`,
resolve the platform `Publisher`; **if the `PlatformAccount` is not `CONNECTED`, write a non-retryable
"needs reconnect" `AuditLog` + set content `MANUAL_REQUIRED` and stop** (edge case "not connected at
publish"); else fetch a valid token (`oauth/tokens.ts`), call `publish()`, write an `AuditLog`
(Principle V), and: success → content `PUBLISHED`, job `SUCCEEDED`; retryable & `attempts<maxAttempts`
→ increment, `nextRunAt = now + backoff(attempts)`, job back to `QUEUED`; permanent/exhausted →
content `FAILED`, job `FAILED`, log the reason. Per-platform isolation (FR-016/FR-027/FR-030).

✅ After this step: the job processor with retry + isolation (`src/lib/queue/process-job.ts`).

## PROMPT 109 — Test process-job

Project: WordPress Social Autopilot. Add `tests/unit/queue/process-job.test.ts` (mock publisher +
Prisma): success → PUBLISHED; retryable failure → re-queued with a future `nextRunAt`; exhausted →
FAILED; not-connected account → MANUAL_REQUIRED. Principle VII, SC-005.

✅ After this step: passing process-job tests (`tests/unit/queue/process-job.test.ts`).

## PROMPT 110 — Worker two-pass loop

Project: WordPress Social Autopilot. Implement `src/lib/queue/worker.ts`: one `tick()` runs a
**generation pass** (select `WordPressPost` where `generatedAt IS NULL` → `ai/generate.ts`
`generateForPost`) then a **publish pass** (select due `PublishJob` `status=QUEUED AND nextRunAt<=now`,
mark `RUNNING`, call `process-job.ts`). Each item is isolated so one failure never aborts the batch
(FR-030). Plan §8.

✅ After this step: the two-pass worker loop (`src/lib/queue/worker.ts`).

## PROMPT 111 — Worker entrypoint

Project: WordPress Social Autopilot. Implement `src/worker/index.ts`: a long-lived process that calls
`worker.tick()` on an interval (graceful shutdown handling). Add a `worker` script to `package.json`.
Plan §8.

✅ After this step: the runnable worker process (`src/worker/index.ts`, `npm run worker`).

## PROMPT 112 — Cron-tick runner route

Project: WordPress Social Autopilot. Implement `src/app/api/worker/tick/route.ts` (POST, protected by a
shared secret/header): drains one `worker.tick()` — the serverless-friendly alternative runner from
the plan's Simplification Notes. Either this OR the long-lived worker is used per deployment.

✅ After this step: a cron-tick runner route (`src/app/api/worker/tick/route.ts`).

## PROMPT 113 — Checkpoint: Queue & Retry

Project: WordPress Social Autopilot. Validate Phase 9 against `quickstart.md` Scenario E and SC-005:
force a publish failure → 3 retries with growing backoff → `FAILED` with a reason; click Retry →
re-queued; other platforms in the batch still complete. Fix issues.

✅ After this step: a verified durable queue with retry, backoff, and per-platform isolation.

---

# Phase 10 — Testing (Cross-Cutting Verification)

## PROMPT 114 — End-to-end pipeline test

Project: WordPress Social Autopilot. Add `tests/integration/pipeline.test.ts`: drive the full pipeline
with everything mocked (signed webhook → generation pass → publish pass) and assert six content items
are created, auto-publish + connected platforms reach `PUBLISHED`, and YouTube is `MANUAL_REQUIRED`.
Covers SC-001/SC-004. Principle VII.

✅ After this step: an end-to-end pipeline test (`tests/integration/pipeline.test.ts`).

## PROMPT 115 — Signature-rejection security test

Project: WordPress Social Autopilot. Add `tests/integration/webhook-security.test.ts`: tampered and
missing signatures are rejected 100% and never produce any `GeneratedContent` or publish. SC-006,
Principle II/VII.

✅ After this step: a security regression test (`tests/integration/webhook-security.test.ts`).

## PROMPT 116 — Coverage matrix

Project: WordPress Social Autopilot. Create `tests/COVERAGE.md` mapping each constitution Principle VII
requirement to its test(s): webhook integration; every Zod schema valid+invalid; every publisher
success/rate-limit/token-expiry/failure; Claude malformed-response. List and fill any gaps found.

✅ After this step: a documented test-coverage matrix (`tests/COVERAGE.md`).

## PROMPT 117 — CI + coverage gate

Project: WordPress Social Autopilot. Add a coverage threshold to `vitest.config.ts`, a `test:ci`
script to `package.json`, and `.github/workflows/ci.yml` running lint + typecheck + tests on push.

✅ After this step: CI with a coverage gate (`.github/workflows/ci.yml`).

## PROMPT 118 — Checkpoint: Testing

Project: WordPress Social Autopilot. Run the full suite (`npm test`); confirm all integration +
unit tests pass and `tests/COVERAGE.md` shows no gaps against Principle VII and the spec's acceptance
scenarios. Fix any failures.

✅ After this step: a green, fully-covered test suite.

---

# Phase 11 — Deployment

## PROMPT 119 — Dockerfiles

Project: WordPress Social Autopilot. Create `Dockerfile` (Next.js 16 app, Node 22) and
`Dockerfile.worker` (the queue worker `src/worker/index.ts`). Multi-stage builds; run `prisma
generate` during build.

✅ After this step: container builds for app + worker (`Dockerfile`, `Dockerfile.worker`).

## PROMPT 120 — Compose config

Project: WordPress Social Autopilot. Create `docker-compose.yml` running the web app, the worker, and
PostgreSQL, wiring env vars from `.env`. Healthcheck for the DB.

✅ After this step: a one-command local stack (`docker-compose.yml`).

## PROMPT 121 — Migration + startup script

Project: WordPress Social Autopilot. Create `scripts/start.sh`: run `npx prisma migrate deploy` then
start the app (and a separate command for the worker). Reference it from the Dockerfiles/compose.

✅ After this step: a production migration + startup script (`scripts/start.sh`).

## PROMPT 122 — Secrets + deployment docs

Project: WordPress Social Autopilot. Create `docs/deployment.md`: how to generate `TOKEN_ENCRYPTION_KEY`
(32-byte base64) and `WEBHOOK_SECRET`, configure each platform's OAuth app + redirect URIs, set the
GitHub OAuth app + `OWNER_GITHUB_LOGIN`, and a full secrets checklist mapped to `plan.md` §9.

✅ After this step: deployment + secrets documentation (`docs/deployment.md`).

## PROMPT 123 — README

Project: WordPress Social Autopilot. Write `README.md`: project overview, the confirmed stack, setup
(install → `.env` → `prisma migrate dev` → `npm run dev` + `npm run worker`), and a pointer to
`specs/001-social-autopilot/quickstart.md` for the end-to-end validation scenarios.

✅ After this step: a complete project README (`README.md`).

## PROMPT 124 — Checkpoint: Deployable

Project: WordPress Social Autopilot. From a clean checkout: configure `.env`, run `prisma migrate
deploy`, build and start the web app + worker (or compose), send a signed test webhook and confirm it
ACKs and a mocked/seeded publish completes end-to-end (`quickstart.md`). Fix any issues.

✅ After this step: a deployable, end-to-end-verified WordPress Social Autopilot.
