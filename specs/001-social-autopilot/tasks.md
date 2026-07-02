---
description: "Task list for WordPress Social Autopilot (feature 001-social-autopilot)"
---

# Tasks: WordPress Social Autopilot

**Input**: Design documents from `specs/001-social-autopilot/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/, quickstart.md, spec.md

**Organization**: Grouped by **feature area** (per request), with `[US#]` labels mapping each
task to its user story (US1 auto-publish · US2 approval · US3 OAuth · US4 status/retry). Tests are
included immediately after each implementation task (test-first where the test can be written
first). Each feature group ends with a **Checkpoint** validation task.

## Format: `[ID] [P?] [Story?] Description with exact file path`

- **[P]**: parallelizable (different file, no dependency on an incomplete task)
- **[US#]**: the user story the task serves (omitted for Setup / Foundational / Testing / Deployment)
- All paths are repository-relative.

## Path Conventions

Single Next.js App Router project: `src/app/`, `src/lib/`, `src/components/`, `src/worker/`,
`prisma/`, `tests/`. Confirmed stack/versions in `research.md` (Principle VIII).

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Initialize Next.js 16.2.9 App Router project with TypeScript 6.0.3 strict mode in `package.json` + `tsconfig.json` (`"strict": true`, `noUncheckedIndexedAccess`), pinning all versions from `research.md`
- [ ] T002 [P] Configure Tailwind CSS 4.3.2 (CSS-first) in `src/app/globals.css` and `postcss.config.mjs` (no `tailwind.config.js` per v4)
- [ ] T003 [P] Configure ESLint + Prettier in `eslint.config.mjs` and `.prettierrc`
- [ ] T004 [P] Configure Vitest in `vitest.config.ts` with a `tests/` root and coverage
- [ ] T005 Implement Zod-validated environment loader in `src/lib/env.ts` (all vars from plan §9; process refuses to boot on failure — Principle II)
- [ ] T006 [P] Unit test env schema (valid + missing/invalid) in `tests/unit/env.test.ts`
- [ ] T007 [P] Create `.env.example` enumerating every variable from plan §9 (no real values)
- [ ] T008 **Checkpoint**: `npm run build` succeeds, `npm test` runs, env loader rejects a missing var — Setup complete

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Blocks all feature work.**

- [ ] T009 Define the full Prisma schema (all 5 models + enums, incl. `WordPressPost.generatedAt`, `@@unique([postId, platform])`, `@@index([status, nextRunAt])`) in `prisma/schema.prisma` per `data-model.md`
- [ ] T010 Generate the initial migration and run it: `prisma/migrations/` (`npx prisma migrate dev --name init`)
- [ ] T011 [P] Implement Prisma client singleton in `src/lib/prisma.ts`
- [ ] T012 Implement AES-256-GCM token encryption (`encrypt`/`decrypt`) in `src/lib/crypto.ts` (key from validated env — FR-018)
- [ ] T013 [P] Unit test crypto round-trip + tamper rejection in `tests/unit/crypto.test.ts`
- [ ] T014 [P] Implement per-platform character limits + word-boundary truncation preserving the link in `src/lib/limits.ts` (FR-011)
- [ ] T015 [P] Unit test truncation (over-limit cut at word boundary, link always preserved, under-limit untouched) in `tests/unit/limits.test.ts`
- [ ] T016 [P] Implement `AuditLog` writer in `src/lib/audit.ts` (one row per attempt/success/failure, no secrets — Principle V, FR-029)
- [ ] T017 [P] Unit test audit writer (records context, strips secrets) in `tests/unit/audit.test.ts`
- [ ] T018 **Checkpoint**: `prisma migrate` applies cleanly, crypto + limits + audit tests pass — Foundation ready

---

## Phase 3: WordPress Integration (US1)

- [ ] T019 [US1] Implement HMAC-SHA256 raw-body signature verify with `timingSafeEqual` in `src/lib/webhook/verify.ts` (FR-002)
- [ ] T020 [P] [US1] Unit test signature verify (valid, invalid, tampered, missing header) in `tests/unit/webhook/verify.test.ts`
- [ ] T021 [US1] Implement WordPress payload Zod schema (title, content, excerpt, featuredImageUrl, url, categories, tags, wpPostId) in `src/lib/wordpress/schema.ts` (FR-004)
- [ ] T022 [P] [US1] Unit test WordPress schema (complete, partial/missing fields, invalid types) in `tests/unit/wordpress/schema.test.ts`
- [ ] T023 [US1] Implement NovaMira MCP fallback `fetchFullPost({wpPostId?,url?})` with Zod-validated response in `src/lib/wordpress/novamira.ts` (FR-005)
- [ ] T024 [P] [US1] Unit test NovaMira fallback (mocked MCP: backfill merge, unretrievable → typed error) in `tests/unit/wordpress/novamira.test.ts`
- [ ] T025 [US1] Implement webhook receiver route (verify → parse → backfill if incomplete → upsert `WordPressPost` dedupe on `wpPostId`, `generatedAt=null` → 202; no content rows/jobs) in `src/app/api/webhooks/wordpress/route.ts` (FR-001/003/006, contracts/webhook.md)
- [ ] T026 [US1] Integration test webhook route (202 + post persisted; 401 invalid/tampered signature; duplicate → no dup; incomplete → NovaMira invoked; ACK <2s) in `tests/integration/webhook.test.ts`
- [ ] T027 **Checkpoint**: send a signed test webhook (quickstart Scenario B step 1) → 202 with `WordPressPost` row and `generatedAt=null`; unsigned → 401 — WordPress ingestion works

---

## Phase 4: Claude AI Integration (US1)

- [ ] T028 [US1] Implement Anthropic client + `MODEL = "claude-opus-4-8"` constant in `src/lib/ai/client.ts` (adaptive thinking; no `budget_tokens`)
- [ ] T029 [US1] Implement per-platform Zod output schemas (`{body, hashtags[]}` with size bounds) in `src/lib/ai/schemas.ts` (Principle IV)
- [ ] T030 [P] [US1] Unit test every output schema (valid + invalid/malformed) in `tests/unit/ai/schemas.test.ts`
- [ ] T031 **Checkpoint**: schemas import cleanly, schema tests pass, client constructs with a mocked key — AI scaffolding ready

---

## Phase 5: Per-Platform Content Generation

> One group per platform: each adds a version-controlled prompt constant (Principle IV) + a
> generation test with **mocked** Claude responses. Prompt rules come from spec FR-010.

### LinkedIn content (US1)

- [ ] T032 [P] [US1] LinkedIn prompt constant (professional, ≤3000 chars, 3–5 hashtags, link + CTA) in `src/lib/ai/prompts/linkedin.ts`
- [ ] T033 [P] [US1] Test LinkedIn generation (mocked Claude → valid schema, within limit, link present) in `tests/unit/ai/generate-linkedin.test.ts`
- [ ] T034 [US1] **Checkpoint**: LinkedIn prompt produces schema-valid copy with backlink (mocked)

### Instagram content (US1)

- [ ] T035 [P] [US1] Instagram prompt constant (visual-first, ≤2200 chars, 10–15 hashtags, first-line hook, link as caption note) in `src/lib/ai/prompts/instagram.ts`
- [ ] T036 [P] [US1] Test Instagram generation in `tests/unit/ai/generate-instagram.test.ts`
- [ ] T037 [US1] **Checkpoint**: Instagram prompt valid (mocked)

### Facebook content (US1)

- [ ] T038 [P] [US1] Facebook prompt constant (conversational, <500 chars target, 2–3 hashtags, clickable link) in `src/lib/ai/prompts/facebook.ts`
- [ ] T039 [P] [US1] Test Facebook generation in `tests/unit/ai/generate-facebook.test.ts`
- [ ] T040 [US1] **Checkpoint**: Facebook prompt valid (mocked)

### YouTube content (US1)

- [ ] T041 [P] [US1] YouTube prompt constant (community/description, ≤5000 chars, timestamps if relevant, link) in `src/lib/ai/prompts/youtube.ts`
- [ ] T042 [P] [US1] Test YouTube generation in `tests/unit/ai/generate-youtube.test.ts`
- [ ] T043 [US1] **Checkpoint**: YouTube prompt valid (mocked); content destined for `MANUAL_REQUIRED`

### X / Twitter content (US1)

- [ ] T044 [P] [US1] X prompt constant (punchy, ≤280 chars, 1–2 hashtags, shortened link) in `src/lib/ai/prompts/x.ts`
- [ ] T045 [P] [US1] Test X generation (esp. 280-char enforcement) in `tests/unit/ai/generate-x.test.ts`
- [ ] T046 [US1] **Checkpoint**: X prompt valid + within 280 (mocked)

### TikTok content (US1)

- [ ] T047 [P] [US1] TikTok prompt constant (trendy, ≤2200 chars, 3–5 hashtags, first-line hook, link as bio note) in `src/lib/ai/prompts/tiktok.ts`
- [ ] T048 [P] [US1] Test TikTok generation in `tests/unit/ai/generate-tiktok.test.ts`
- [ ] T049 [US1] **Checkpoint**: TikTok prompt valid (mocked)

### Content-generation orchestrator (US1)

- [ ] T050 [US1] Wire prompt registry (platform → prompt) in `src/lib/ai/prompts/index.ts`
- [ ] T051 [US1] Implement `generateForPost(post)` in `src/lib/ai/generate.ts`: per-platform `messages.parse` + `zodOutputFormat`, append backlink, run `limits.ts`, create `GeneratedContent` row, set status (APPROVED+enqueue / PENDING / FAILED on unusable / MANUAL_REQUIRED), stamp `generatedAt`; isolate per-platform failures with `Promise.allSettled` (FR-008/009/011/016/030)
- [ ] T052 [US1] Test `generateForPost` (mocked Claude: all six produced; malformed → FAILED; one platform error doesn't block others) in `tests/unit/ai/generate.test.ts`
- [ ] T053 [US1] **Checkpoint**: generation produces six schema-valid items each with a backlink and within limits (SC-001/SC-002, quickstart Scenario B step 2)

---

## Phase 6: Per-Platform Publishing

> One group per platform: an isolated `Publisher` module (Principle III) + tests covering
> **success, rate-limit (429), token-expiry→refresh→retry, and permanent failure** (Principle VII).
> Modules use injected/mocked `fetch` and tokens — no live network in tests.

### Publishing foundation (US1)

- [ ] T054 [US1] Define `Publisher` interface + `PublishResult` types in `src/lib/publishers/types.ts`
- [ ] T055 [US1] Implement publisher registry (`Record<Platform, Publisher>`) in `src/lib/publishers/index.ts`

### LinkedIn publisher (US1)

- [ ] T056 [P] [US1] LinkedIn publisher (`POST /rest/posts`, `LinkedIn-Version: 202606`, commentary+article) in `src/lib/publishers/linkedin.ts`
- [ ] T057 [P] [US1] Test LinkedIn publisher (success / 429 / token-expiry refresh / failure, mocked fetch) in `tests/unit/publishers/linkedin.test.ts`
- [ ] T058 [US1] **Checkpoint**: LinkedIn publish path verified (mocked)

### Instagram publisher (US1)

- [ ] T059 [P] [US1] Instagram publisher (two-step `/media` → `/media_publish`, `requiresMedia`; no image → non-retryable MANUAL_REQUIRED) in `src/lib/publishers/instagram.ts`
- [ ] T060 [P] [US1] Test Instagram publisher (container flow success / no-media skip / 25-per-24h limit / failure) in `tests/unit/publishers/instagram.test.ts`
- [ ] T061 [US1] **Checkpoint**: Instagram container publish verified (mocked)

### Facebook publisher (US1)

- [ ] T062 [P] [US1] Facebook publisher (`POST /{pageId}/feed`, Page token, message+link) in `src/lib/publishers/facebook.ts`
- [ ] T063 [P] [US1] Test Facebook publisher (success / 429 / failure) in `tests/unit/publishers/facebook.test.ts`
- [ ] T064 [US1] **Checkpoint**: Facebook publish verified (mocked)

### YouTube publisher (US1)

- [ ] T065 [P] [US1] YouTube publisher (`autoPublish=false`; returns non-retryable MANUAL_REQUIRED — no community-post API) in `src/lib/publishers/youtube.ts`
- [ ] T066 [P] [US1] Test YouTube publisher (always MANUAL_REQUIRED, no fetch call) in `tests/unit/publishers/youtube.test.ts`
- [ ] T067 [US1] **Checkpoint**: YouTube correctly holds for manual (mocked)

### X / Twitter publisher (US1)

- [ ] T068 [P] [US1] X publisher (`POST /2/tweets`, OAuth2 bearer) in `src/lib/publishers/x.ts`
- [ ] T069 [P] [US1] Test X publisher (success / token-expiry refresh-rotate / 429 / failure) in `tests/unit/publishers/x.test.ts`
- [ ] T070 [US1] **Checkpoint**: X publish verified (mocked)

### TikTok publisher (US1)

- [ ] T071 [P] [US1] TikTok publisher (`requiresMedia`; inbox/draft `content/init/` flow until audited) in `src/lib/publishers/tiktok.ts`
- [ ] T072 [P] [US1] Test TikTok publisher (draft flow success / no-media skip / failure) in `tests/unit/publishers/tiktok.test.ts`
- [ ] T073 [US1] **Checkpoint**: TikTok draft publish verified (mocked); all 6 publishers registered

---

## Phase 7: OAuth Flows (US3)

- [ ] T074 [US3] Per-platform OAuth config (auth/token URLs, scopes, `usesPkce`) in `src/lib/oauth/config.ts` (values from research.md)
- [ ] T075 [US3] PKCE helpers (verifier/challenge) in `src/lib/oauth/pkce.ts`
- [ ] T076 [P] [US3] Unit test PKCE helpers in `tests/unit/oauth/pkce.test.ts`
- [ ] T077 [US3] Token manager `getValidAccessToken` (decrypt → refresh if expired → re-encrypt rotated token → status TOKEN_EXPIRED on failure) in `src/lib/oauth/tokens.ts` (FR-019/020)
- [ ] T078 [P] [US3] Test token manager (valid passthrough / refresh-rotate persisted / refresh fail → TOKEN_EXPIRED) in `tests/unit/oauth/tokens.test.ts`
- [x] T079 [US3] OAuth start route (state cookie, PKCE for X, redirect to provider) in `src/app/api/oauth/[platform]/start/route.ts` (FR-017)
- [x] T080 [US3] OAuth callback route (validate state, exchange code, Meta long-lived + page/IG ids, encrypt+store, status CONNECTED) in `src/app/api/oauth/[platform]/callback/route.ts`
- [x] T081 [P] [US3] Test callback (mocked exchange → tokens stored encrypted, status CONNECTED; bad state → 400) in `tests/integration/oauth-callback.test.ts`
- [x] T082 [US3] Connections API (GET statuses without token material; DELETE disconnect purges tokens) in `src/app/api/connections/route.ts` (FR-020/021, contracts/oauth.md)
- [x] T083 [P] [US3] Test connections API (GET hides tokens; DELETE purges → DISCONNECTED) in `tests/integration/connections.test.ts`
- [x] T084 [US3] **Checkpoint**: connect a platform (mocked) → CONNECTED with encrypted token; expire → TOKEN_EXPIRED alert; disconnect → DISCONNECTED (quickstart Scenarios A & G) — encrypted-store + hidden-tokens + disconnect covered in `oauth-callback.test.ts` / `connections.test.ts`; TOKEN_EXPIRED transition is covered by `tokens.test.ts` (T078)

---

## Phase 8: Dashboard (US2, US4)

- [x] T085 [US2] NextAuth v4 options (GitHub provider, JWT session, owner allowlist via `OWNER_GITHUB_LOGIN`) in `src/lib/auth.ts` (FR-022)
- [x] T086 [US2] NextAuth route handler exporting `{GET, POST}` in `src/app/api/auth/[...nextauth]/route.ts`
- [x] T087 [P] [US2] Sign-in page in `src/app/(auth)/signin/page.tsx`
- [x] T088 [US2] Auth-guarded dashboard layout + sidebar (redirect to /signin) in `src/app/(dashboard)/layout.tsx`
- [x] T089 [P] [US4] `GET /api/posts` (posts + per-platform status) in `src/app/api/posts/route.ts` (FR-022/024, contracts/dashboard-api.md)
- [x] T090 [P] [US4] `GET /api/posts/[postId]` (post + six previews) in `src/app/api/posts/[postId]/route.ts` (FR-023)
- [x] T091 [P] [US4] Test posts APIs (401 unauthenticated; correct per-platform statuses) in `tests/integration/posts-api.test.ts`
- [x] T092 [US2] Approve route (PENDING → APPROVED + enqueue PublishJob) in `src/app/api/content/[contentId]/approve/route.ts` (FR-015)
- [x] T093 [US2] Reject route (→ REJECTED, never publishes) in `src/app/api/content/[contentId]/reject/route.ts` (FR-015)
- [ ] T094 [US4] Manual retry route (FAILED → reset attempts/nextRunAt, re-queue) in `src/app/api/content/[contentId]/retry/route.ts` (FR-026)
- [ ] T095 [P] [US2] Test approve/reject/retry routes (state transitions, 409 on invalid state, 401 unauth) in `tests/integration/content-actions.test.ts`
- [ ] T096 [US3] Auto-publish toggle route (`PATCH`, per-platform) in `src/app/api/settings/auto-publish/route.ts` (FR-025)
- [ ] T097 [P] [US3] Test auto-publish toggle (per-platform persistence) in `tests/integration/auto-publish.test.ts`
- [ ] T098 [P] [US4] Status + presentational components (`StatusBadge.tsx`, `PostList.tsx`, `PostRow.tsx`) in `src/components/`
- [ ] T099 [P] [US2] `PlatformPreviewCard.tsx` (preview body+hashtags+link, Approve/Reject) + `RetryButton.tsx` in `src/components/`
- [ ] T100 [P] [US3] `ConnectionCard.tsx`, `ConnectionStatus.tsx`, `AutoPublishToggle.tsx` in `src/components/`
- [ ] T101 [US4] Dashboard posts page (Server Component → PostList; client poll for live status) in `src/app/(dashboard)/dashboard/page.tsx` (FR-024)
- [ ] T102 [US2] Post detail page (six PlatformPreviewCards) in `src/app/(dashboard)/posts/[postId]/page.tsx` (FR-023)
- [ ] T103 [US3] Connections page (six ConnectionCards) in `src/app/(dashboard)/connections/page.tsx`
- [ ] T104 [US2] **Checkpoint**: sign in as owner; preview pending → approve → published; reject another; expired token alerts; failed item shows Retry (quickstart Scenarios C & E partial)

---

## Phase 9: Queue and Retry Logic (US1, US4)

- [x] T105 [US4] Exponential backoff + full jitter (`2^attempt * base`) in `src/lib/queue/backoff.ts` (FR-028)
- [x] T106 [P] [US4] Test backoff delay sequence + jitter bounds in `tests/unit/queue/backoff.test.ts`
- [x] T107 [US1] Enqueue helper (create `PublishJob (QUEUED)`) in `src/lib/queue/enqueue.ts`
- [x] T108 [US1] Process-one-job (account-status guard → MANUAL_REQUIRED if not CONNECTED; resolve Publisher; token; publish; AuditLog; success/retry-with-backoff/permanent-fail) in `src/lib/queue/process-job.ts` (FR-016/027/030)
- [x] T109 [US4] Test process-job (success → PUBLISHED; retryable → re-queued with nextRunAt; exhausted → FAILED; not-connected → MANUAL_REQUIRED) in `tests/unit/queue/process-job.test.ts`
- [x] T110 [US1] Worker two-pass loop (generation pass: posts where `generatedAt IS NULL`; publish pass: drain due `PublishJob`) in `src/lib/queue/worker.ts`
- [x] T111 [US1] Worker entrypoint (long-lived process) in `src/worker/index.ts`
- [x] T112 [P] [US1] Pluggable cron-tick runner route (drains one tick) in `src/app/api/worker/tick/route.ts` (Simplification Note alternative)
- [x] T113 [US4] **Checkpoint**: force a publish failure → 3 retries with growing backoff → FAILED with reason; manual Retry re-queues; other platforms unaffected (quickstart Scenario E, SC-005) — retry/backoff/exhaustion/isolation covered in `process-job.test.ts`; manual Retry route lands in Phase 8 (T094)

---

## Phase 10: Testing (Cross-Cutting Verification)

- [ ] T114 End-to-end pipeline integration test (signed webhook → generation pass → publish pass, all mocked) asserting six items + auto-publish published + YouTube MANUAL_REQUIRED in `tests/integration/pipeline.test.ts`
- [ ] T115 [P] Signature-rejection security test (tampered/missing signature never produces published content — SC-006) in `tests/integration/webhook-security.test.ts`
- [ ] T116 [P] Verify Principle VII coverage matrix: every Zod schema has valid+invalid tests; every publisher has success/rate-limit/expiry/failure; Claude malformed-response tested — document gaps in `tests/COVERAGE.md`
- [ ] T117 Add `npm test` coverage gate and CI script in `package.json` + `.github/workflows/ci.yml`
- [ ] T118 **Checkpoint**: full `npm test` green; coverage matrix complete — all spec acceptance scenarios have a test

---

## Phase 11: Deployment

- [ ] T119 [P] Dockerfile(s) for the Next.js app and the queue worker in `Dockerfile` and `Dockerfile.worker`
- [ ] T120 [P] Compose/process config running web + worker + Postgres in `docker-compose.yml`
- [ ] T121 Production migration + startup script (`prisma migrate deploy`) in `scripts/start.sh`
- [ ] T122 [P] Generate `TOKEN_ENCRYPTION_KEY`/`WEBHOOK_SECRET` instructions + secrets checklist in `docs/deployment.md`
- [ ] T123 [P] README with run/validate instructions referencing `quickstart.md` in `README.md`
- [ ] T124 **Checkpoint**: clean checkout → configure env → `migrate deploy` → web + worker boot; webhook ACKs and a mocked publish completes end-to-end — Deployable

---

## Dependencies & Execution Order

### Phase order

- **Setup (P1)** → **Foundational (P2)** block everything.
- **WordPress (P3)**, **Claude AI (P4)** → required before **Content Generation (P5)**.
- **Content Generation (P5)** + **Publishing (P6)** → wired by **Queue/Retry (P9)**.
- **OAuth (P7)** provides tokens used at publish time (mocked in tests until then).
- **Dashboard (P8)** depends on OAuth (connections) + content/queue (actions).
- **Testing (P10)** after feature phases; **Deployment (P11)** last.

### User-story view

- **US1 (P1, MVP)**: P3 + P4 + P5 + P6 + P9 → publish-once-promote-everywhere.
- **US3 (P2)**: P7 (real tokens) — prerequisite for live publishing.
- **US2 (P2)**: P8 approval surface (approve/reject/preview).
- **US4 (P3)**: P9 retry + P8 status/retry UI.

### Within a group

Tests follow their implementation task; `[P]` tasks touch different files and may run together.

## Parallel Execution Examples

```text
# Setup (after T001):
T002 Tailwind · T003 ESLint · T004 Vitest · T006 env test · T007 .env.example

# Foundational (after T009/T010):
T011 prisma singleton · T013 crypto test · T014 limits · T016 audit  (+ their [P] tests)

# Content Generation — all six prompt files + tests in parallel:
T032/T033 LinkedIn · T035/T036 Instagram · T038/T039 Facebook · T041/T042 YouTube ·
T044/T045 X · T047/T048 TikTok

# Publishing — all six publishers + tests in parallel (after T054/T055):
T056/T057 · T059/T060 · T062/T063 · T065/T066 · T068/T069 · T071/T072

# Dashboard components in parallel:
T098 · T099 · T100
```

## Implementation Strategy

### MVP (US1 only)

Complete **P1 → P2 → P3 → P4 → P5 → P6 → P9** (using a manually-seeded `PlatformAccount` token to
exercise publishing), then validate quickstart Scenarios B & D. This delivers
publish-once-promote-everywhere — the headline value — before OAuth UI and the dashboard exist.

### Incremental delivery

1. MVP (US1) → demo auto-generation + publish (mocked/seeded tokens).
2. - P7 OAuth (US3) → real account connection & refresh.
3. - P8 Dashboard (US2/US4) → preview/approve/reject + status + manual retry.
4. - P10 Testing hardening, + P11 Deployment.

### Notes

- Tests are first-class per Principle VII; do not mark a feature group complete until its tests
  pass (its Checkpoint enforces this).
- Per-platform isolation (FR-016/030) is validated in `generate.test.ts` and `process-job.test.ts`.
- No secrets in logs or audit context (Principle II/V) — assert this in `audit.test.ts`.
