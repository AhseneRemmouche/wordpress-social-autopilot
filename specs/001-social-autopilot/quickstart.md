# Quickstart & Validation: WordPress Social Autopilot

**Feature**: `001-social-autopilot` | **Date**: 2026-06-29
A run-and-validate guide proving the feature works end-to-end. Implementation detail lives in
`tasks.md`; exact versions are in `research.md`.

## Prerequisites

- Node.js 22 LTS, PostgreSQL reachable via `DATABASE_URL`.
- A GitHub OAuth app (dashboard auth) → `GITHUB_CLIENT_ID/SECRET`, `OWNER_GITHUB_LOGIN`.
- Developer apps/credentials for the social platforms you intend to connect (see research.md for
  scopes; note X is pay-per-use and YouTube has no community-post API).
- NovaMira MCP reachable (`NOVAMIRA_MCP_URL`, `NOVAMIRA_MCP_TOKEN`, `WORDPRESS_SITE_URL`).
- `WEBHOOK_SECRET` (HMAC) and `TOKEN_ENCRYPTION_KEY` (32-byte base64).

## Setup

```bash
# 1. Install pinned deps (versions from research.md)
npm install

# 2. Configure environment (validated at startup by lib/env.ts)
cp .env.example .env   # fill every variable in plan.md §9

# 3. Database
npx prisma migrate dev --name init
npx prisma generate

# 4. Run app + worker (two processes)
npm run dev            # Next.js (dashboard + API routes)
npm run worker         # queue worker (publishes / retries)
```

## Validation scenarios

### Scenario A — Sign in & connect an account (US3)

1. Open the app → redirected to GitHub sign-in; sign in as `OWNER_GITHUB_LOGIN`.
2. Go to **Connections**, click **Connect** on LinkedIn → complete OAuth → status shows
   **CONNECTED**. ✅ Tokens are stored encrypted (verify the DB column is ciphertext, not plain).
3. Toggle **Auto-publish** on for LinkedIn. ✅ Persists per platform.

### Scenario B — Webhook → generation → publish (US1, MVP)

1. Send a signed test webhook:

   ```bash
   BODY='{"wpPostId":"1","title":"Hello","content":"Body…","excerpt":"x","url":"https://site/hello","categories":["news"],"tags":["a"],"featuredImageUrl":"https://site/img.jpg","event":"post_published"}'
   SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | sed 's/^.* //')
   curl -i -X POST http://localhost:3000/api/webhooks/wordpress \
     -H "Content-Type: application/json" -H "X-WSA-Signature: sha256=$SIG" -d "$BODY"
   ```

   ✅ Returns **202** in < 2s (SC-003).

2. Open **Dashboard** → the post appears with six platform rows. ✅ Content generated per
   platform, each within its char limit and containing the post link (SC-001, SC-002).
3. LinkedIn (auto-publish on) → status transitions to **PUBLISHED**. ✅ (US1)
4. YouTube row shows **MANUAL_REQUIRED** (no community-post API — research.md). ✅

### Scenario C — Approval flow (US2)

1. Leave a platform (e.g., Facebook) on manual approval.
2. After Scenario B, its content sits **PENDING**. Open the post → **preview** the exact copy.
3. **Approve** → enqueues and publishes → **PUBLISHED**. **Reject** another → **REJECTED**, never
   published. ✅ (FR-014/FR-015)

### Scenario D — Signature rejection (security, SC-006)

```bash
curl -i -X POST http://localhost:3000/api/webhooks/wordpress \
  -H "Content-Type: application/json" -H "X-WSA-Signature: sha256=deadbeef" -d "$BODY"
```

✅ Returns **401**; nothing is generated or published.

### Scenario E — Failure, retry, recovery (US4, SC-005)

1. Force a platform publish to fail (e.g., revoke its token or point its base URL at a stub
   returning 500).
2. Worker retries up to 3× with exponential backoff + jitter; after exhaustion the row shows
   **FAILED** with an error reason (no secrets). ✅
3. Click **Retry** → re-queued → publishes (or fails again). ✅ (FR-026)
4. Other platforms in the same batch still completed (FR-030). ✅

### Scenario F — Incomplete payload → NovaMira backfill

1. Send a signed webhook missing `content`/`featuredImageUrl`.
2. ✅ The system fetches the full post via NovaMira MCP, then generates normally. If the post
   can't be retrieved, the run is marked failed with a clear reason and nothing publishes.

### Scenario G — Token expiry alert (SC-008)

1. Simulate an expired, non-refreshable token (e.g., LinkedIn non-partner).
2. ✅ Connections shows **TOKEN_EXPIRED** with a reconnect prompt; that platform is flagged, not
   silently dropped.

## Automated test entry points (Principle VII)

```bash
npm test                     # all unit + integration
npm test webhook             # FR-002/003 receiver (contracts/webhook.md)
npm test publishers          # mocked per-platform publish paths
npm test schemas             # Zod schemas valid + invalid
npm test ai/generate         # mocked Claude responses
```

Maps to: integration tests for the webhook; unit tests for every Zod schema, each publisher
(mocked API), Claude generation (mocked), backoff, crypto, and truncation.
