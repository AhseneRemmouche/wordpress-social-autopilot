# Contract: OAuth Connection Endpoints

Requirements FR-017..FR-021. Per-platform config (auth/token URLs, scopes) is in research.md.

## `GET /api/oauth/[platform]/start`

- **Auth**: authenticated owner session.
- **Behavior**: generate `state` (CSRF) cookie; for X, generate a PKCE `code_verifier`/`challenge`
  and store the verifier in a secure cookie. Redirect (302) to the provider authorize URL with
  the platform's scopes (research.md).
- `[platform]` ∈ `linkedin | facebook | instagram | x | tiktok | youtube`.

## `GET /api/oauth/[platform]/callback`

- **Query**: `code`, `state` (and provider-specific params).
- **Behavior**: validate `state`; exchange `code` at the token URL (PKCE verifier for X);
  receive `{ access_token, refresh_token?, expires_in, scope }`. For Meta, exchange short-lived
  → long-lived token and resolve `fbPageId` / `igUserId`. **Encrypt** tokens (AES-256-GCM) and
  upsert `PlatformAccount` with `status=CONNECTED`, `expiresAt`, `scope`. Redirect to
  `/connections`.
- **Errors**: invalid `state` → 400; token exchange failure → redirect to `/connections?error=...`
  (no secrets in the message).

## `GET /api/connections`

- **Auth**: owner session.
- **Returns**: per-platform status array (never returns token values, FR-018):

```json
[
  { "platform": "LINKEDIN", "status": "CONNECTED", "expiresAt": "…", "autoPublish": true },
  { "platform": "X", "status": "TOKEN_EXPIRED", "expiresAt": "…", "autoPublish": false }
]
```

`status` ∈ `CONNECTED | TOKEN_EXPIRED | DISCONNECTED` (FR-020). `TOKEN_EXPIRED` drives the
reconnect alert.

## `DELETE /api/connections?platform=<P>`

- **Behavior**: purge stored (encrypted) tokens, set `status=DISCONNECTED` (FR-021). Returns 200.

## Token refresh (server-side, `lib/oauth/tokens.ts`)

- `getValidAccessToken(platform)`: decrypt; if expired/near-expiry and refresh supported, POST the
  refresh grant, **persist the rotated refresh token** (X/TikTok rotate), return a fresh access
  token (FR-019). If refresh unsupported/fails → set `TOKEN_EXPIRED`, surface reconnect.

## Contract tests

- start → 302 to correct authorize URL with correct scopes; X includes PKCE challenge.
- callback (mocked exchange) → tokens encrypted at rest, status CONNECTED.
- connections GET never includes token material.
- disconnect purges tokens, status DISCONNECTED.
- refresh rotation persists the new refresh token; failure sets TOKEN_EXPIRED.
