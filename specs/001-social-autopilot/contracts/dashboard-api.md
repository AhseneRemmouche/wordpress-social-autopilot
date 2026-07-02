# Contract: Dashboard Data & Action Endpoints

All endpoints require an authenticated owner session (GitHub via NextAuth; FR-022).
Requirements FR-022..FR-026, FR-015.

## `GET /api/posts`

List of triggering posts with per-platform status (FR-022, FR-024).

```json
[
  {
    "id": "…",
    "title": "…",
    "url": "…",
    "receivedAt": "…",
    "platforms": [
      { "platform": "LINKEDIN", "contentId": "…", "status": "PUBLISHED" },
      { "platform": "X", "contentId": "…", "status": "FAILED" }
    ]
  }
]
```

## `GET /api/posts/[postId]`

One post + its six `GeneratedContent` previews (FR-023).

```json
{
  "id": "…",
  "title": "…",
  "url": "…",
  "content": [
    {
      "contentId": "…",
      "platform": "INSTAGRAM",
      "status": "PENDING",
      "body": "…",
      "hashtags": ["#…"],
      "link": "…",
      "charCount": 1320
    }
  ]
}
```

## `POST /api/content/[contentId]/approve`

Approve a `PENDING` item → set `APPROVED` and enqueue a `PublishJob` (FR-015). 200 → `{ "status": "APPROVED" }`. Invalid state (not PENDING) → 409.

## `POST /api/content/[contentId]/reject`

Set `REJECTED`; never publishes (FR-015). 200 → `{ "status": "REJECTED" }`.

## `POST /api/content/[contentId]/retry`

Manual retry of a `FAILED` item (FR-026): reset job `attempts`/`nextRunAt`, re-queue. 200 →
`{ "status": "APPROVED", "requeued": true }`. Non-FAILED → 409.

## `PATCH /api/settings/auto-publish`

Toggle per-platform auto-publish (FR-025).

Request: `{ "platform": "LINKEDIN", "autoPublish": true }`
Response: `{ "platform": "LINKEDIN", "autoPublish": true }`

Independent per platform; affects only subsequent posts.

## Status semantics (FR-024)

`PENDING | APPROVED | PUBLISHED | FAILED` are the spec's required dashboard states, plus
`REJECTED` and `MANUAL_REQUIRED` (YouTube no-API / IG·TikTok media-or-audit gaps).

## Contract tests

- list/detail return correct per-platform statuses.
- approve enqueues a job and flips status; reject never enqueues.
- retry only valid from FAILED; re-queues with reset attempts.
- auto-publish toggle is per-platform and persisted.
- all endpoints 401 without an owner session.
