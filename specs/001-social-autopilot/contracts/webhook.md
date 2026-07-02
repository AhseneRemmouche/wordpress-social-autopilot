# Contract: WordPress Webhook Receiver

**Endpoint**: `POST /api/webhooks/wordpress`
**Auth**: HMAC-SHA256 signature (not session). Requirements FR-001..FR-006.

## Request

Headers:

| Header            | Required | Notes                                                   |
| ----------------- | -------- | ------------------------------------------------------- |
| `Content-Type`    | yes      | `application/json`                                      |
| `X-WSA-Signature` | yes      | `sha256=<hex>` = `HMAC_SHA256(rawBody, WEBHOOK_SECRET)` |

Body (JSON) — fields the WordPress plugin sends on publish:

```json
{
  "wpPostId": "1234",
  "title": "string",
  "content": "string (HTML or text)",
  "excerpt": "string",
  "featuredImageUrl": "https://… (nullable)",
  "url": "https://site/post-slug",
  "categories": ["string"],
  "tags": ["string"],
  "event": "post_published"
}
```

Any of `content`, `excerpt`, `featuredImageUrl`, `categories`, `tags` may be missing/empty →
triggers NovaMira backfill (FR-005).

## Behavior

1. Read the **raw** request body (before JSON parse).
2. Recompute HMAC-SHA256 over the raw body with `WEBHOOK_SECRET`; compare to `X-WSA-Signature`
   using `crypto.timingSafeEqual`. Mismatch → **401**, no processing (FR-002).
3. Parse via Zod. Missing required fields → call NovaMira MCP (`fetchFullPost`) and merge.
4. Upsert `WordPressPost` on `wpPostId` (dedupe, FR-006).
5. Create one `GeneratedContent (PENDING)` per platform; enqueue background generation.
6. Respond **202 Accepted** immediately (FR-003); all generation/publishing is async.

## Responses

| Status             | When                                     | Body                                      |
| ------------------ | ---------------------------------------- | ----------------------------------------- |
| `202 Accepted`     | valid signature, accepted for processing | `{ "accepted": true, "postId": "<id>" }`  |
| `401 Unauthorized` | signature missing or invalid             | `{ "error": "invalid signature" }`        |
| `400 Bad Request`  | body unparseable AND backfill impossible | `{ "error": "..." }`                      |
| `200 OK`           | duplicate `wpPostId` already processed   | `{ "accepted": true, "duplicate": true }` |

## Contract tests (Principle VII — `tests/integration/webhook.test.ts`)

- valid signature + complete payload → 202, creates post + 6 content rows.
- invalid/missing signature → 401, nothing persisted.
- tampered body (signature over different bytes) → 401.
- duplicate `wpPostId` → no duplicate rows.
- incomplete payload → NovaMira backfill invoked (mocked) → 202.
- ACK returns in < 2s with generation mocked/deferred (SC-003).
