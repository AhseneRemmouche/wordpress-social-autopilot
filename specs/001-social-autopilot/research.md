# Research: WordPress Social Autopilot

**Feature**: `001-social-autopilot` | **Date**: 2026-06-29
**Constitution gate**: Principle VIII (Framework Version Policy) — all versions below were
confirmed against official documentation on 2026-06-29 before any implementation.

## Confirmed Framework & Library Versions

All versions are the latest stable releases confirmed on 2026-06-29. Pin these in
`package.json`; do not float to `latest`.

| Dependency    | Confirmed Version | Source                               | Notes                                         |
| ------------- | ----------------- | ------------------------------------ | --------------------------------------------- |
| Next.js       | **16.2.9**        | registry.npmjs.org/next              | App Router, React Server Components           |
| TypeScript    | **6.0.3**         | registry.npmjs.org/typescript        | `strict: true` mandatory (Principle I)        |
| Zod           | **4.4.3**         | registry.npmjs.org/zod               | All runtime-boundary validation (Principle I) |
| Prisma        | **7.8.0**         | registry.npmjs.org/prisma            | + `@prisma/client` 7.8.0; PostgreSQL          |
| Tailwind CSS  | **4.3.2**         | registry.npmjs.org/tailwindcss       | Dashboard UI                                  |
| NextAuth.js   | **4.24.14**       | registry.npmjs.org/next-auth         | GitHub provider; see decision below           |
| Anthropic SDK | **0.107.0**       | registry.npmjs.org/@anthropic-ai/sdk | `@anthropic-ai/sdk`                           |

### Decision: Claude model for content generation

- **Decision**: Use `claude-opus-4-8` (Claude Opus 4.8) for all platform content generation.
- **Rationale**: It is the most capable widely-available model and the constitution directs
  defaulting to the latest, most capable Claude models. Marketing/social copy benefits from
  the strongest writing model; per-post cost is small relative to the value.
- **API specifics** (from the claude-api skill, authoritative): adaptive thinking only
  (`thinking: {type: "adaptive"}` — `budget_tokens` returns 400); use `output_config.format`
  (Zod-validated structured outputs via `client.messages.parse()`) to force a typed JSON
  shape per platform; no assistant prefills.
- **Alternatives considered**: `claude-sonnet-4-6` (cheaper, slightly less capable writing) —
  rejected for the default per constitution; remains a fallback if cost becomes a concern.

### Decision: NextAuth.js v4 (stable) vs Auth.js v5 (beta)

- **Decision**: Use `next-auth` **4.24.14** (latest stable) with the GitHub provider, in JWT
  session strategy, restricted to the owner's GitHub login.
- **Rationale**: Principle VIII mandates the latest **stable** version. Auth.js v5
  (`next-auth@beta`, the 5.x line) has cleaner App Router ergonomics but is still beta and
  therefore disqualified by the version policy. v4 works with the App Router via a route
  handler at `app/api/auth/[...nextauth]/route.ts`.
- **Alternatives considered**: Auth.js v5 beta — rejected (not stable). Re-evaluate when v5
  reaches a stable release.

## Social Platform API Findings (confirmed 2026-06-29)

These APIs change far faster than npm packages and materially affect scope. Several platforms
**cannot** do exactly what a naive reading of the spec assumed — captured here so the plan and
publisher modules are built against reality.

### LinkedIn

- **API version**: date-based `LinkedIn-Version` header; latest confirmed **`202606`**. Header
  is mandatory; stale versions error.
- **Publish endpoint**: `POST https://api.linkedin.com/rest/posts` with headers
  `LinkedIn-Version: 202606`, `X-Restli-Protocol-Version: 2.0.0`. Text + link = `commentary`
  plus a `content.article` object (URL/title/description).
- **OAuth 2.0**: authorize `https://www.linkedin.com/oauth/v2/authorization`, token
  `https://www.linkedin.com/oauth/v2/accessToken`. Scope **`w_member_social`** (member post);
  `w_organization_social` for org pages (requires Community Management API review).
- **Tokens**: access token ~60 days; **programmatic refresh gated to approved partners** —
  otherwise re-run the auth flow. Plan: store `expiresAt`; surface "token expired" on the
  dashboard when refresh is unavailable.
- **Rate limit**: ~150 posts/member/day.
- **Gotcha**: legacy `ugcPosts`/Shares APIs deprecated — use `/rest/posts`.

### Meta — Facebook Pages & Instagram (Graph API)

- **API version**: latest stable **`v25.0`** (Feb 2026). Base `https://graph.facebook.com/v25.0`.
- **Facebook Page post**: `POST /{page-id}/feed` with `message` + `link`. Requires a **Page
  access token**; scopes `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`.
  Links ARE clickable.
- **Instagram**: requires the **Instagram Graph API** with an Instagram **Business/Creator**
  account linked to a Facebook Page. **Two-step container flow**: (1) `POST /{ig-user-id}/media`
  with `image_url` + `caption`, (2) `POST /{ig-user-id}/media_publish` with `creation_id`.
  Scope `instagram_content_publish`. **Constraint: a media URL is required — Instagram cannot
  post text-only.** We use the WordPress featured image URL. Links in captions are NOT
  clickable (caption-note per spec FR-010).
- **OAuth/tokens**: short-lived user token (~1h) → long-lived user token (~60 days) via
  `fb_exchange_token`; long-lived **Page tokens derived from it do not expire** (invalidated on
  password/permission change). Refresh by re-exchanging before expiry.
- **Rate limit**: Instagram **25 posts / rolling 24h** per account; check via
  `GET /{ig-user-id}/content_publishing_limit`.
- **Gotcha**: posts with no featured image must skip Instagram (or use a default brand image) —
  the publisher must handle "no media" gracefully.

### YouTube

- **API**: Data API **v3**, host `https://www.googleapis.com/youtube/v3`.
- **CRITICAL**: **There is no public API to create community posts.** No `communityPosts.insert`
  / `posts.insert` exists; the legacy `activities.insert` (channel bulletins) was removed in
  2020 and is non-functional. The 500-subscriber rule applies only to the manual Studio UI.
- **Scopes**: `youtube.force-ssl`, `youtube`, `youtube.upload` — none grants community posting.
- **Decision for this phase**: YouTube content is **generated and held for manual posting**
  (status surfaced on the dashboard; the owner copies it into Studio). Optional future path:
  attach the link as a video description via `videos.update`. **YouTube has no auto-publish
  path** — the dashboard auto-publish toggle is disabled/no-op for YouTube, and its publisher
  module records `MANUAL_REQUIRED` rather than calling an API. This matches the spec's YouTube
  edge case.

### X (Twitter)

- **API**: **v2**, `POST /2/tweets`, host `api.x.com`.
- **OAuth**: OAuth 2.0 Authorization Code **with PKCE**. Scopes `tweet.read`, `tweet.write`,
  `users.read`, **`offline.access`** (required for refresh tokens). Authorize
  `https://x.com/i/oauth2/authorize`, token `https://api.x.com/2/oauth2/token`.
- **Tokens**: access token ~2h; **refresh tokens rotate on each use** — always persist the new
  refresh token after every refresh.
- **MAJOR 2026 change**: X moved to **pay-per-use as the default (Feb 2026)** and removed the
  standard Free tier for new developers. Posting costs ~**$0.015/post**, **+$0.20 if the post
  contains a link**. Every autopilot post includes a backlink, so each X post costs ~$0.20.
  **Plan implication**: surface this cost reality in docs; X is fully supported technically but
  the owner must be on a paid/pay-per-use plan. 280-char default limit stands.

### TikTok

- **API**: Content Posting API v2, base `https://open.tiktokapis.com/v2/post/publish/`.
- **CRITICAL constraints**:
  1. **No text-only posts** — video or photo carousel only. We attach the WordPress featured
     image (photo post via `content/init/`); text goes in the caption; the link is bio-only
     (non-clickable), per spec FR-010.
  2. **Audit gating** — unaudited apps are forced to **`SELF_ONLY`** visibility (private). Public
     direct-publish (`PUBLIC_TO_EVERYONE`) requires passing TikTok's app audit.
  3. `creator_info/query/` must be called before posting; photos must be hosted on a
     verified/owned domain.
- **Flows**: **Direct Post** (`content/init/` for photo → upload → poll `status/fetch/`) or
  **Upload/Draft (inbox)** — content lands in the creator's drafts to finish manually (no audit
  needed). **Decision**: default TikTok to the **inbox/draft flow** until the app is audited;
  expose Direct Post once audited. Treat TikTok like a "queue for manual finish" platform
  initially.
- **OAuth scopes**: `video.publish` (direct) / `video.upload` (inbox).
- **Tokens**: access 24h, refresh 365 days (`POST /v2/oauth/token/`), refresh token may rotate.

## Cross-Cutting Decisions

### Background processing (non-blocking webhook — FR-003)

- **Decision**: The webhook route verifies the HMAC signature, persists the inbound post, and
  enqueues a job, returning `202 Accepted` immediately. A separate worker drains the queue.
- **Mechanism**: a **database-backed job queue** (the `PublishJob` table) drained by a worker
  loop. For local/single-instance deployment, a Node worker process polls `PublishJob` rows;
  the design leaves room to swap in a hosted queue (e.g., a cron-triggered route or a queue
  service) without changing the publisher modules.
- **Rationale**: avoids adding Redis/BullMQ as a hard dependency for v1 while satisfying
  non-blocking + at-least-once retry; Prisma is the single source of truth (Principle V).
- **Alternatives**: BullMQ + Redis (more robust, heavier infra) — deferred; Next.js
  `after()`/background fetch (no durability/retry) — rejected.

### Retry strategy (FR-028) — exponential backoff with jitter

- **Decision**: up to **3** automatic retries; delay = `base * 2^attempt` with full jitter,
  e.g. `base = 2s` → ~2s, ~4s, ~8s (± jitter). Stored on `PublishJob` as `attempts`,
  `nextRunAt`. Distinguish retryable (5xx, 429, network, token-expiry-then-refresh) from
  permanent (4xx validation, audit-required) failures — permanent failures don't consume
  retries.

### Token encryption at rest (Principle II, FR-018)

- **Decision**: AES-256-GCM encryption of access/refresh tokens before persistence, using a
  key from a Zod-validated env var (`TOKEN_ENCRYPTION_KEY`, 32 bytes base64). A small
  `lib/crypto.ts` provides `encrypt()/decrypt()`. Tokens never logged.
- **Alternatives**: Prisma field-level extension/middleware encryption — viable; chosen explicit
  helper for clarity and testability.

### Environment validation at startup (Principle II)

- **Decision**: a single `lib/env.ts` parses `process.env` through a Zod schema at module load;
  the process refuses to boot on failure.

### NovaMira MCP fallback (FR-005)

- **Decision**: when the webhook payload is missing required fields, call the **NovaMira MCP**
  server to fetch the full WordPress post by ID/URL. Wrap the MCP call in `lib/wordpress/novamira.ts`
  with a Zod-validated response; on failure, mark the run failed with a clear reason (no partial
  publish). MCP tool access is loaded on demand (per MCP integration pattern).

### Webhook signature (FR-002) — HMAC-SHA256

- **Decision**: WordPress sends `X-WSA-Signature: sha256=<hex>` computed as
  `HMAC-SHA256(rawBody, WEBHOOK_SECRET)`. The route reads the **raw body** (not re-serialized),
  recomputes, and compares with `crypto.timingSafeEqual`. Reject on mismatch before any work.

## Summary of platform capability matrix (drives publisher design)

| Platform    | Auto-publish?                | Needs media?    | Link clickable?   | Token refresh             | Key constraint            |
| ----------- | ---------------------------- | --------------- | ----------------- | ------------------------- | ------------------------- |
| LinkedIn    | ✅                           | No              | ✅                | Re-auth (partner refresh) | `202606` header           |
| Facebook    | ✅                           | No              | ✅                | Long-lived Page token     | Page token                |
| Instagram   | ✅                           | **Yes (image)** | No (caption note) | Long-lived                | 25/24h; skip if no image  |
| X / Twitter | ✅                           | No              | ✅ (shortened)    | Rotating refresh          | **~$0.20/post (paid)**    |
| TikTok      | ⚠️ inbox/draft until audited | **Yes (image)** | No (bio note)     | 24h access / 365d refresh | audit + media             |
| YouTube     | ❌ manual hold               | No              | ✅                | n/a                       | **no community-post API** |
