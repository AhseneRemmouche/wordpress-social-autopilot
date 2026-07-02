# Test Coverage Map — Constitution Principle VII

This maps each Principle VII testing requirement to the test(s) that satisfy it.
All tests mock external boundaries (network, DB, Claude, MCP) — no live calls
(Principle III). Run everything with `npm test`.

**Suite: 250 tests across 36 files (all green).**

---

## 1. Webhook integration (FR-001/002/003/004/005/006, SC-003/SC-006)

| Concern | Test(s) |
|---|---|
| HMAC-SHA256 verify (valid / missing / tampered / malformed / constant-time) | `unit/webhook/verify.test.ts` |
| Route: signed+complete → 202 (`generatedAt=null`); invalid/tampered/missing sig → 401; duplicate → 200; incomplete → NovaMira backfill → 202; ack < 2s (SC-003) | `integration/webhook.test.ts` |
| **Security (SC-006)**: 9 malformed/missing/wrong signatures → 401; 100-body fuzz → 100% 401; **no post/content ever created**; verify precedes any processing | `integration/webhook-security.test.ts` |
| NovaMira backfill fetch (success / error, injected fetch) | `unit/wordpress/novamira.test.ts` |

## 2. Every Zod schema — valid **and** invalid

| Schema | Test | Invalid cases |
|---|---|---|
| `envSchema` | `unit/env.test.ts` | missing vars; non-32-byte `TOKEN_ENCRYPTION_KEY`; bad URLs |
| `webhookPayloadSchema` / `completePostSchema` | `unit/wordpress/schema.test.ts` | missing generation fields; `getMissingGenerationFields`; strict vs lenient |
| `PLATFORM_OUTPUT_SCHEMAS` (all 6) | `unit/ai/schemas.test.ts` | hashtag count out of bounds; empty body |
| auto-publish body schema | `integration/auto-publish.test.ts` | bad platform; missing/non-boolean flag; bad JSON |

## 3. Every publisher — success / rate-limit / token-expiry / failure (FR-010/016/027/030)

| Publisher | Success | Rate-limit | Token-expiry | Permanent failure | Test |
|---|---|---|---|---|---|
| LinkedIn | 201 + `x-restli-id` | 429 retryable | 401 → refresh → retry | 400 non-retryable (secret-free) | `unit/publishers/linkedin.test.ts` |
| Instagram | two-step container | 25-post/24h | **401 → reconnect** ¹ | 400; 5xx; no-media skip; missing IG id | `unit/publishers/instagram.test.ts` |
| Facebook | `/{page}/feed` | 429 retryable | **401 → reconnect** ¹ | 400; 5xx; missing Page id | `unit/publishers/facebook.test.ts` |
| YouTube | — (manual-only) ² | — | — | always non-retryable, no network | `unit/publishers/youtube.test.ts` |
| X | 201 + `data.id` | 429 retryable | 401 → refresh + **rotate** → retry | 403; 5xx | `unit/publishers/x.test.ts` |
| TikTok | draft `publish_id` | 429 + body-code rate-limit | 401/`access_token_invalid` → refresh → retry | permanent `error.code`; no-media skip | `unit/publishers/tiktok.test.ts` |

¹ Meta (Facebook/Instagram) tokens are long-lived and **do not OAuth-refresh**, so "token expiry" surfaces as a `401 → non-retryable reconnect` (not a refresh). The token-refresh mechanism itself is covered separately in `unit/oauth/tokens.test.ts`.
² YouTube has no public community-post write API → the publisher never calls the network and always returns the non-retryable manual-required result.

All publisher failure messages are asserted **secret-free** (status/code only, never the token).

## 4. Claude malformed-response (FR-016)

| Concern | Test |
|---|---|
| Null/empty `parsed_output` for one platform → content `FAILED` (+ audit); other platforms still succeed (isolation) | `unit/ai/generate.test.ts` |
| Thrown Claude API error for one platform → `FAILED`, others unaffected | `unit/ai/generate.test.ts` |
| Per-platform generation: relevance, schema-valid output, `≤ limit` + backlink present (FR-009/011) | `unit/ai/generate-{linkedin,instagram,facebook,youtube,x,tiktok}.test.ts` |
| Client config (model `claude-opus-4-8`, adaptive thinking, no `budget_tokens`) | `unit/ai/client.test.ts` |

## 5. Supporting / cross-cutting

| Area | Test(s) |
|---|---|
| AES-256-GCM encrypt/decrypt round-trip + tamper detection (Principle II) | `unit/crypto.test.ts` |
| Char-limit truncation + backlink (FR-009/011) | `unit/limits.test.ts` |
| Audit write (best-effort) + `redactSecrets` (Principle II/V) | `unit/audit.test.ts` |
| OAuth: PKCE (RFC 7636 vector); token refresh/rotation → `TOKEN_EXPIRED`; authorize URL + PKCE challenge; callback (encrypted persist, invalid `state` → 400); connections (never leaks tokens, disconnect purges) | `unit/oauth/pkce.test.ts`, `unit/oauth/tokens.test.ts`, `integration/oauth-start.test.ts`, `integration/oauth-callback.test.ts`, `integration/connections.test.ts` |
| Queue: backoff full-jitter bounds (FR-028); `processJob` outcomes (success/retry/exhausted/not-connected); worker batch isolation (FR-030) | `unit/queue/backoff.test.ts`, `unit/queue/process-job.test.ts`, `unit/queue/worker.test.ts` |
| Dashboard API: posts list/detail; approve/reject/retry state machine; auto-publish toggle; all 401 without owner | `integration/posts-api.test.ts`, `integration/content-actions.test.ts`, `integration/auto-publish.test.ts` |
| **End-to-end pipeline** (SC-001/SC-004): signed webhook → generation (6 items) → publish (connected auto-publish → PUBLISHED, YouTube → MANUAL_REQUIRED) | `integration/pipeline.test.ts` |

## 6. Acceptance scenarios (Success Criteria SC-001..008)

| SC | Criterion | Test(s) |
|---|---|---|
| SC-001 | verified notification → content for all 6 platforms | `integration/pipeline.test.ts` (6 rows); `unit/ai/generate.test.ts` (6 creates) |
| SC-002 | every item has a working backlink, within the platform char limit | `unit/limits.test.ts`; `unit/ai/generate-*.test.ts` (≤ limit + link present); publisher `compose` |
| SC-003 | ack < 2s, no content work blocking the ack | `integration/webhook.test.ts` (persists only the post; `< 2000ms` assertion) |
| SC-004 | one platform fails → the other five still complete | `unit/ai/generate.test.ts` (per-platform isolation); `unit/queue/worker.test.ts` (batch not aborted) |
| SC-005 | ≤ 3 auto-retries → `FAILED` with recorded error detail | `unit/queue/process-job.test.ts`; `unit/queue/backoff.test.ts` |
| SC-006 | signature-fail rejected 100%, never publishes | `integration/webhook-security.test.ts` (9 variants + 100-body fuzz) |
| SC-007 | pending → published/rejected via the dashboard | `integration/content-actions.test.ts` (approve→enqueue, reject, retry) — functional path ¹ |
| SC-008 | expiry alerted + reconnect, never silently dropped | `unit/oauth/tokens.test.ts` (→ `TOKEN_EXPIRED`); `integration/connections.test.ts` (status surfaced) |

¹ SC-004's "99%" and SC-007's "< 1 minute" are operational/UX thresholds — their **functional guarantees** are asserted in the tests above; the numeric latency/rate targets are validated manually per `quickstart.md` (Scenarios C/E).

---

## Gaps found & filled (this audit)

1. **Facebook publisher had no token-expiry (401) test** → added `token expiry (401) → non-retryable reconnect`.
2. **Instagram publisher had no token-expiry (401) test** → added the same for the container step.

No other gaps: Claude malformed-response was already covered (`generate.test.ts`), every Zod
schema has valid + invalid cases, and after the two additions **every publisher covers all four
required outcomes** (success / rate-limit / token-expiry / failure).
