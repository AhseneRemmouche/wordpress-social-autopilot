# Data Model: WordPress Social Autopilot

**Feature**: `001-social-autopilot` | **Date**: 2026-06-29
Prisma 7.8.0 + PostgreSQL. The Prisma schema is the single source of truth (Principle V).

## Enums

```prisma
enum Platform {
  LINKEDIN
  FACEBOOK
  INSTAGRAM
  X
  TIKTOK
  YOUTUBE
}

enum ContentStatus {
  PENDING           // generated, awaiting approval or queueing
  APPROVED          // approved by owner, enqueued
  REJECTED          // owner rejected; never publishes
  PUBLISHED         // successfully posted to platform
  FAILED            // exhausted retries / permanent failure
  MANUAL_REQUIRED   // no API path (YouTube) or audit/media gap (TikTok/IG)
}

enum JobStatus {
  QUEUED
  RUNNING
  SUCCEEDED
  FAILED
}

enum AccountStatus {
  CONNECTED
  TOKEN_EXPIRED
  DISCONNECTED
}

enum AuditOutcome {
  ATTEMPT
  SUCCESS
  FAILURE
}
```

## Models

### WordPressPost — the triggering article

| Field              | Type                      | Notes                                                                                                           |
| ------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `id`               | String @id @default(cuid) |                                                                                                                 |
| `wpPostId`         | String @unique            | dedupe key (FR-006)                                                                                             |
| `title`            | String                    |                                                                                                                 |
| `content`          | String @db.Text           |                                                                                                                 |
| `excerpt`          | String @db.Text           |                                                                                                                 |
| `featuredImageUrl` | String?                   | required for IG/TikTok publish                                                                                  |
| `url`              | String                    | backlink target (FR-009)                                                                                        |
| `categories`       | String[]                  |                                                                                                                 |
| `tags`             | String[]                  |                                                                                                                 |
| `sourceComplete`   | Boolean @default(true)    | false if NovaMira backfill was needed                                                                           |
| `receivedAt`       | DateTime @default(now)    | webhook persists this; no content rows yet                                                                      |
| `generatedAt`      | DateTime?                 | null until the worker generation pass completes; the pass selects `generatedAt IS NULL` (prevents reprocessing) |
| `generatedContent` | GeneratedContent[]        | relation (rows created by the worker, not the webhook)                                                          |

### GeneratedContent — one row per platform per post (Clarification)

| Field                     | Type                            | Notes                                          |
| ------------------------- | ------------------------------- | ---------------------------------------------- |
| `id`                      | String @id @default(cuid)       |                                                |
| `postId`                  | String                          | FK → WordPressPost                             |
| `platform`                | Platform                        |                                                |
| `body`                    | String @db.Text                 | generated copy (incl. link per platform rules) |
| `hashtags`                | String[]                        |                                                |
| `link`                    | String                          | backlink (always present, FR-009)              |
| `charCount`               | Int                             | post-truncation length (FR-011)                |
| `status`                  | ContentStatus @default(PENDING) | lifecycle                                      |
| `createdAt` / `updatedAt` | DateTime                        |                                                |
| `jobs`                    | PublishJob[]                    | relation                                       |
| `auditLogs`               | AuditLog[]                      | relation                                       |

Constraint: `@@unique([postId, platform])` — exactly one content row per platform per post.

### PublishJob — durable queue row (Section 8)

| Field                     | Type                       | Notes                 |
| ------------------------- | -------------------------- | --------------------- |
| `id`                      | String @id @default(cuid)  |                       |
| `contentId`               | String                     | FK → GeneratedContent |
| `status`                  | JobStatus @default(QUEUED) |                       |
| `attempts`                | Int @default(0)            |                       |
| `maxAttempts`             | Int @default(3)            | FR-028                |
| `nextRunAt`               | DateTime @default(now)     | backoff schedule      |
| `lastError`               | String?                    | secret-free message   |
| `createdAt` / `updatedAt` | DateTime                   |                       |

Index: `@@index([status, nextRunAt])` for the worker poll. `PublishJob` is **publish-only** —
content generation is a separate worker pass keyed off `WordPressPost.generatedAt IS NULL`, not a
job in this table.

### PlatformAccount — one table, platform column (Clarification), encrypted tokens

| Field                       | Type                                 | Notes                                      |
| --------------------------- | ------------------------------------ | ------------------------------------------ |
| `id`                        | String @id @default(cuid)            |                                            |
| `platform`                  | Platform @unique                     | single owner ⇒ one row per platform        |
| `status`                    | AccountStatus @default(DISCONNECTED) | FR-020                                     |
| `accessToken`               | String?                              | AES-256-GCM ciphertext (FR-018)            |
| `refreshToken`              | String?                              | AES-256-GCM ciphertext; rotates (X/TikTok) |
| `expiresAt`                 | DateTime?                            | token expiry                               |
| `scope`                     | String?                              | granted scopes                             |
| `autoPublish`               | Boolean @default(false)              | per-platform toggle (FR-025)               |
| `externalAccountId`         | String?                              | platform user/account id                   |
| `fbPageId`                  | String?                              | Facebook page (Meta)                       |
| `igUserId`                  | String?                              | Instagram business user (Meta)             |
| `metadata`                  | Json?                                | platform-specific extras                   |
| `connectedAt` / `updatedAt` | DateTime                             |                                            |

### AuditLog — one row per attempt/success/failure (Principle V)

| Field          | Type                      | Notes                                             |
| -------------- | ------------------------- | ------------------------------------------------- |
| `id`           | String @id @default(cuid) |                                                   |
| `contentId`    | String                    | FK → GeneratedContent                             |
| `platform`     | Platform                  |                                                   |
| `attempt`      | Int                       | which attempt number                              |
| `outcome`      | AuditOutcome              | ATTEMPT / SUCCESS / FAILURE                       |
| `externalId`   | String?                   | platform post id on success                       |
| `errorContext` | Json?                     | request/response context, **no secrets** (FR-027) |
| `createdAt`    | DateTime @default(now)    |                                                   |

Index: `@@index([contentId])`.

## Relationships

```
WordPressPost 1───* GeneratedContent 1───* PublishJob
                                    └──────* AuditLog
PlatformAccount  (independent; resolved by `platform` at publish time)
```

## Lifecycle (GeneratedContent.status)

```
                 generation
                    │
            ┌───────┴────────┐
   auto-publish on        manual-approval on        no API / media gap
            │                  │                          │
        PENDING→APPROVED    PENDING ──approve→ APPROVED   MANUAL_REQUIRED
            │                  │                  │
         (enqueue)          reject→REJECTED    (enqueue)
            │                                     │
            ▼                                     ▼
         publish attempt (PublishJob, retry ×3 w/ backoff+jitter)
            │
     ┌──────┴───────┐
 success         exhausted/permanent
     │                  │
 PUBLISHED           FAILED ──manual retry (FR-026)→ re-queue
```

## Validation rules (enforced via Zod at boundaries, mirrored by schema)

- `wpPostId`, `title`, `content`, `url` are required to start a run; missing fields trigger
  NovaMira backfill (FR-005). If still missing after backfill → run failed, no partial publish.
- `GeneratedContent.body` must contain `link`; `charCount` ≤ platform limit after truncation
  (FR-011); hashtag counts within platform bounds (FR-010).
- Tokens are encrypted before write and never returned to the dashboard or logs (FR-018).
- Exactly one `GeneratedContent` per `(postId, platform)`; duplicate webhooks do not create
  duplicates (FR-006) via upsert on `wpPostId`.
