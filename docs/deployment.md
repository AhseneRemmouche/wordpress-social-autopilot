# Deployment Guide

How to configure secrets, OAuth apps, and environment for **WordPress Social
Autopilot**. All variables are validated by `src/lib/env.ts` (Zod) at startup —
the app refuses to boot on invalid config (Constitution Principle II). The
authoritative variable list is `plan.md` §9; the checklist at the end maps to it.

---

## 1. Generate the security secrets

### `TOKEN_ENCRYPTION_KEY` — 32-byte base64 (AES-256-GCM at rest, FR-018)

Must decode to **exactly 32 bytes** or the app won't start.

```bash
openssl rand -base64 32
# or
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Rotating this key makes previously-encrypted tokens undecryptable — after a
rotation, every platform must be reconnected.

### `WEBHOOK_SECRET` — HMAC-SHA256 shared secret (FR-002)

The WordPress side signs each webhook body with this exact value
(`X-WSA-Signature: sha256=<hex>`). Use a long random string and set the **same**
value in the WordPress webhook plugin.

```bash
openssl rand -hex 32
```

### `NEXTAUTH_SECRET` — session/JWT signing

```bash
openssl rand -base64 32
```

Store all three in your secret manager (or `.env`, which is **git- and
Docker-ignored**). Never commit them; never log them.

---

## 2. GitHub OAuth app (dashboard sign-in)

The dashboard is single-owner: only `OWNER_GITHUB_LOGIN` may sign in.

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. **Homepage URL**: your `APP_BASE_URL` (e.g. `https://autopilot.example.com`).
3. **Authorization callback URL**:
   ```
   {NEXTAUTH_URL}/api/auth/callback/github
   ```
4. Copy the **Client ID** → `GITHUB_CLIENT_ID` and generate a **Client Secret** →
   `GITHUB_CLIENT_SECRET`.
5. Set `OWNER_GITHUB_LOGIN` to your GitHub **username** (the allowlisted owner).

`NEXTAUTH_URL` and `APP_BASE_URL` are normally the same public origin.

---

## 3. Platform OAuth apps + redirect URIs

Every platform's OAuth callback is:

```
{APP_BASE_URL}/api/oauth/<slug>/callback
```

Register this **exact** redirect URI in each provider's developer console.

| Platform | slug | Redirect URI | Scopes (`src/lib/oauth/config.ts`) | Env vars |
|---|---|---|---|---|
| LinkedIn | `linkedin` | `{APP_BASE_URL}/api/oauth/linkedin/callback` | `openid profile w_member_social` | `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` |
| Facebook | `facebook` | `{APP_BASE_URL}/api/oauth/facebook/callback` | `pages_show_list pages_manage_posts pages_read_engagement business_management instagram_basic instagram_content_publish` | `META_APP_ID` / `META_APP_SECRET` |
| Instagram | `instagram` | `{APP_BASE_URL}/api/oauth/instagram/callback` | *(same Meta app as Facebook)* | `META_APP_ID` / `META_APP_SECRET` |
| X (Twitter) | `x` | `{APP_BASE_URL}/api/oauth/x/callback` | `tweet.read tweet.write users.read offline.access` (PKCE) | `X_CLIENT_ID` / `X_CLIENT_SECRET` |
| TikTok | `tiktok` | `{APP_BASE_URL}/api/oauth/tiktok/callback` | `user.info.basic video.publish video.upload` (PKCE) | `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` |
| YouTube | `youtube` | `{APP_BASE_URL}/api/oauth/youtube/callback` | `youtube.readonly` | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |

Per-platform notes:

- **LinkedIn** — LinkedIn Developer app with *Sign In with LinkedIn using OpenID
  Connect* + *Share on LinkedIn* products. `openid profile` resolve the member URN
  (the publish author); `w_member_social` posts. Access tokens are ~60 days and
  **not refreshable** for most apps → expiry means reconnect.
- **Meta (Facebook + Instagram)** — ONE Meta app covers both. Requires a Facebook
  **Page** and an **Instagram Business/Creator account linked to that Page**.
  App Review is needed for `pages_manage_posts` / `instagram_content_publish` in
  production. Instagram publishing **requires a featured image**; without one the
  item is held as `MANUAL_REQUIRED`.
- **X** — OAuth 2.0 **with PKCE**, confidential client. `offline.access` is what
  returns a refresh token (X access tokens last ~2h). Posting is **pay-per-use**
  on X's paid API tiers — an account/billing concern.
- **TikTok** — Login Kit v2 **with PKCE**. Until your app passes TikTok's audit,
  posts are created as **private inbox drafts** (`video.upload`) — the app holds
  TikTok content as `MANUAL_REQUIRED` this phase (`TIKTOK_AUDITED = false`).
- **YouTube / Google** — Google Cloud OAuth client. **Connect-only**: the public
  YouTube Data API has no community-post write endpoint, so YouTube content is
  always `MANUAL_REQUIRED`. The connection exists for account display; the flow
  uses `access_type=offline` + `prompt=consent` for a refresh token.

Set `APP_BASE_URL` to the public HTTPS origin before registering redirect URIs —
providers require them to match exactly.

---

## 4. WordPress source + NovaMira backfill

| Var | Purpose |
|---|---|
| `WORDPRESS_SITE_URL` | The single WordPress site this hub serves |
| `NOVAMIRA_MCP_URL` / `NOVAMIRA_MCP_TOKEN` | NovaMira MCP endpoint used to backfill missing webhook fields (content/excerpt/featured image) |

Point your WordPress webhook plugin at `{APP_BASE_URL}/api/webhooks/wordpress`
with the shared `WEBHOOK_SECRET`.

---

## 5. Secrets checklist (mapped to `plan.md` §9)

Validated by `src/lib/env.ts` at startup — **all are required**:

- [ ] `DATABASE_URL` — Postgres connection string *(Core)*
- [ ] `NEXTAUTH_URL` — public origin for NextAuth *(Core)*
- [ ] `NEXTAUTH_SECRET` — session signing *(Core)*
- [ ] `APP_BASE_URL` — origin for OAuth redirect URIs *(Core)*
- [ ] `WEBHOOK_SECRET` — HMAC-SHA256 shared secret *(Security, FR-002)*
- [ ] `TOKEN_ENCRYPTION_KEY` — 32-byte base64 *(Security, FR-018)*
- [ ] `GITHUB_CLIENT_ID` *(Dashboard auth)*
- [ ] `GITHUB_CLIENT_SECRET` *(Dashboard auth)*
- [ ] `OWNER_GITHUB_LOGIN` — owner allowlist *(Dashboard auth)*
- [ ] `ANTHROPIC_API_KEY` *(Claude)*
- [ ] `NOVAMIRA_MCP_URL` *(WordPress fallback)*
- [ ] `NOVAMIRA_MCP_TOKEN` *(WordPress fallback)*
- [ ] `WORDPRESS_SITE_URL` *(WordPress fallback)*
- [ ] `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`
- [ ] `META_APP_ID` / `META_APP_SECRET` *(Facebook + Instagram)*
- [ ] `X_CLIENT_ID` / `X_CLIENT_SECRET`
- [ ] `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` *(YouTube)*

### Deployment-only variables (not validated by `env.ts`)

| Var | Used by | Default | Notes |
|---|---|---|---|
| `CRON_SECRET` | `/api/worker/tick` (GET/POST) | *(unset)* | **Required to use the cron runner.** Fail-closed: when unset the endpoint is **disabled (503)** — never open. When set, callers must send `Authorization: Bearer <CRON_SECRET>`. Vercel Cron adds this header automatically when `CRON_SECRET` is a project env var. |
| `WORKER_POLL_MS` | `src/worker/index.ts` | `10000` | Long-lived worker poll interval (ms) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `docker-compose.yml` | `wsa` / `wsa` / `wordpress_social_autopilot` | Compose derives the internal `DATABASE_URL` from these |
| `POSTGRES_PORT` / `WEB_PORT` | `docker-compose.yml` | `5433` / `3000` | Host port mappings |

---

## 6. Running the queue

Pick **one** per deployment (plan §8 Simplification Note):

- **Long-lived worker** — `docker-compose.yml`'s `worker` service (or `npm run
  worker`). Polls every `WORKER_POLL_MS`.
- **Serverless cron** — hit `/api/worker/tick` (GET or POST) with the
  `Authorization: Bearer $CRON_SECRET` header (Vercel Cron / GitHub Actions /
  systemd timer). `vercel.json` ships a `*/5 * * * *` cron for this path (Vercel
  adds the auth header automatically when `CRON_SECRET` is set; sub-daily cron
  schedules require a Vercel plan that supports them). Do **not** run both the
  cron and the long-lived worker against the same database.

## 7. Deploy

```bash
cp .env.example .env      # fill in every value from the checklist above
docker compose up --build # postgres (healthcheck) → web + worker (migrate deploy on start)
```

`scripts/start.sh` runs `prisma migrate deploy` before starting each service, so
the schema is applied automatically on first boot.

## 8. Deploying to Vercel (web app)

Vercel hosts the **Next.js app** (dashboard + API + cron). The **queue worker does
not run on Vercel** (no long-lived process) — either rely on the `vercel.json`
cron that hits `/api/worker/tick`, or run `Dockerfile.worker` elsewhere. Don't run
both against the same database.

1. **Push to Git** (GitHub/GitLab/Bitbucket) if you haven't:
   `git init && git add -A && git commit -m "…" && git push`.
2. **Import the repo** at vercel.com → *New Project*. Framework auto-detects as
   **Next.js**; `vercel.json` overrides the build to `prisma generate && next build`
   (so the Prisma client is generated on a clean install).
3. **Environment variables** — add every value from §5 for **Production** *and*
   **Preview** (Project → Settings → Environment Variables). Notes:
   - `DATABASE_URL` → a hosted Postgres (Vercel Postgres / Neon / Supabase).
   - `APP_BASE_URL` and `NEXTAUTH_URL` → your production URL
     (e.g. `https://autopilot.example.com`).
   - `CRON_SECRET` → required for the cron. Vercel Cron automatically sends
     `Authorization: Bearer $CRON_SECRET`; the endpoint is **disabled (503)**
     without it (§5).
4. **Cron** — `vercel.json` schedules `POST/GET /api/worker/tick` every 5 min.
   Sub-daily cron schedules require a Vercel plan that supports them; on Hobby,
   run the worker container instead.
5. **Preview deployments** are enabled by default — every PR/branch gets a unique
   preview URL that builds and serves the UI.
6. **OAuth redirect URIs** (§2–§3) must match the deployment origin exactly.
   Register the **production** callbacks (`{APP_BASE_URL}/api/oauth/<slug>/callback`
   and the GitHub callback). Preview URLs change per deployment, so complete OAuth
   connect flows on the stable **production** domain (or register a preview URL
   explicitly for testing).

Run database migrations against the hosted DB once (from any machine with its
`DATABASE_URL`): `npx prisma migrate deploy`.

## 9. Deploying to Netlify (web app)

Netlify hosts the **Next.js app** via its Next.js Runtime (`@netlify/plugin-nextjs`),
auto-detected on deploy — **Next.js 16 is supported**, no plugin config required.
`netlify.toml` pins the build command and Node version:

```toml
[build]
  command = "prisma generate && next build"
[build.environment]
  NODE_VERSION = "22"
```

Netlify has **no built-in cron** and its serverless functions have a short timeout,
so the **queue worker does not run on Netlify**. Leave `CRON_SECRET` unset (the tick
endpoint stays disabled/503, §5) and run the queue elsewhere — a long-lived
`Dockerfile.worker`, or an external scheduler (e.g. GitHub Actions) hitting
`/api/worker/tick` with the `Authorization: Bearer $CRON_SECRET` header. A data-only
demo needs no worker.

1. **Push to GitHub**, then **import the repo** at app.netlify.com → *Add new site →
   Import from GitHub*. Set the site name to fix the `*.netlify.app` origin.
2. **Provision Postgres** (Neon / Supabase). With Neon, use the **pooled** connection
   string (host contains `-pooler`) plus `?sslmode=require` as `DATABASE_URL` for the
   app. Run migrations against the **direct** (non-pooled) endpoint once —
   transaction-mode poolers can reject migration advisory locks:
   ```bash
   # direct endpoint = the pooled host with "-pooler" removed
   DATABASE_URL="postgresql://…@ep-xxxx.<region>.aws.neon.tech/db?sslmode=require" \
     npx prisma migrate deploy
   ```
3. **Environment variables** — Site configuration → Environment variables →
   **Add a variable → Import from a .env file**, and paste every value from §5. Notes:
   - Keep the scope as **All scopes**: the vars are read at **build time**
     (`prisma generate` needs `DATABASE_URL`; `next build` runs `env.ts` validation)
     *and* at runtime. Missing them fails the build with
     `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`.
   - `NEXTAUTH_URL` and `APP_BASE_URL` → `https://<site>.netlify.app`.
   - When re-importing to change a value, pick the **Update conflicts** merge strategy
     (the default *Skip conflicts* keeps the old value).
   - Netlify env-var changes only take effect on a **new deploy** — redeploy after editing.
4. **GitHub OAuth callback** (§2) → `https://<site>.netlify.app/api/auth/callback/github`.
5. **Deploy** — *Deploys → Trigger deploy*. If the first build ran before the vars
   existed (e.g. auto-build on repo connect), just redeploy once the vars are set.

`vercel.json` is ignored by Netlify and can remain in the repo.
