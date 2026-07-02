# GO-LIVE-PROMPTS — WordPress Social Autopilot (real keys, real publishing)

Paste-one-at-a-time prompts to take the deployed app from **demo placeholders** to
**publishing real WordPress posts to the real MLSCampus social accounts**. Same
workflow as `ALL-PROMPTS.md` / `ui-prompts.md`: run each in order, let the checks
pass, confirm the `✅` line, then move on.

**Chosen direction**
- Test target is the **Netlify production deploy** — `https://wordpress-social-autopilot.netlify.app`
  (stable HTTPS origin: every OAuth redirect URI is registered against it, and the
  WordPress webhook reaches it directly).
- **One platform at a time, easiest first**: Foundation → LinkedIn → X → Facebook →
  Instagram → YouTube → TikTok → live-site switch. **A phase's checkpoint is a
  blocking gate — do not start the next platform until every box is checked.**
- **Real MLSCampus accounts** — every publish test ends with *verify, then
  delete/hide the test post* (social side + WordPress side).
- WordPress: the app points at **dev.mlscampus.ai** for all testing; switching to
  **mlscampus.com** is the final, explicitly-gated phase. Claude Code gets MCP
  access to **both** sites via `.mcp.json` to drive test posts and verification.
- The queue worker does **not** run on Netlify: during testing every publish is
  driven by a manual tick — `curl -H "Authorization: Bearer $CRON_SECRET"
  https://wordpress-social-autopilot.netlify.app/api/worker/tick` — which also
  keeps each test controlled. A scheduled GitHub Actions tick is added at the end.

**Standing constraints (every prompt obeys these)**
- **Never print, log, or commit a secret value.** Secrets go only into the Netlify
  env UI, the untracked local `.env`, user-level OS env vars, or GitHub Actions
  secrets. Claude asks the user to paste secrets at the moment they're needed and
  never echoes them back.
- **Netlify env changes take effect only after a redeploy.** The procedure is
  always: Site configuration → Environment variables → *Add a variable → Import
  from a .env file* → merge strategy **Update conflicts** → Deploys → *Trigger
  deploy* → wait for green. Never test against a stale deploy.
- **Auto-publish stays OFF for every platform until Phase H.** All publishes go
  through manual Approve in the dashboard, then a manual worker tick.
- Exact names come from the code, not memory: env vars per `src/lib/env.ts`,
  scopes/URLs per `src/lib/oauth/config.ts`, redirect path is always
  `https://wordpress-social-autopilot.netlify.app/api/oauth/<platform>/callback`.
- Every test post is cleaned up: the social post deleted/hidden via the platform
  UI, the WordPress test post deleted (via MCP) once the phase is verified.
- No app code changes are expected in this playbook. If a real-world API response
  reveals a genuine code bug, fix it with the normal quality bar (typecheck, lint,
  tests, build) before continuing the phase.

**Doc-check policy** — provider consoles and API terms change frequently: before
each platform's console setup, 📋 verify the current flow against the provider's
official developer docs (URLs in each prompt) and note any drift from what the
prompt describes. The code's scopes/endpoints are authoritative for what the app
sends; the docs are authoritative for how to click through the console.

---

## Phase A — Foundation (secrets, worker, WordPress dev wiring, MCP)

**PROMPT GL-01** — Project: WordPress Social Autopilot. **Preflight audit (read-only).** Read `src/lib/env.ts`, `docs/deployment.md` §5+§9, and `.env.example`. Confirm the Netlify deploy is healthy (site loads, GitHub sign-in works) and list — as a table — every env var that is still a placeholder (`demo-unused` / `https://example.com`) vs. already real, plus which phase of this playbook will fill it. Also confirm `/api/worker/tick` currently returns 503 (CRON_SECRET unset). ✅ After this step: a go-live checklist table exists in the conversation; nothing was modified.

**PROMPT GL-02** — Project: WordPress Social Autopilot. **Core secrets: Anthropic, webhook, worker.** (1) User creates a real API key at console.anthropic.com → `ANTHROPIC_API_KEY`. (2) Generate `WEBHOOK_SECRET` and `CRON_SECRET` locally (`openssl rand -base64 32` or the node crypto one-liner). (3) Update the local `.env`, then import the three into Netlify (Update conflicts) and redeploy. 📋 Doc-check nothing external — but verify with `curl`: no header → 401, `Authorization: Bearer $CRON_SECRET` → 200 `{ok:true,...}` (empty tick). ✅ After this step: the tick endpoint is alive and authenticated; generation has a real Claude key.

**PROMPT GL-03** — Project: WordPress Social Autopilot. **Claude Code MCP access to both WordPress sites.** Create `.mcp.json` at the repo root with two HTTP MCP servers — `wordpress-dev` and `wordpress-live` — whose `url` and `Authorization: Bearer …` header expand from env vars `WSA_WP_DEV_MCP_URL` / `WSA_WP_DEV_MCP_TOKEN` / `WSA_WP_LIVE_MCP_URL` / `WSA_WP_LIVE_MCP_TOKEN` (placeholders only — safe to commit). User supplies the NovaMira MCP URL + token for dev.mlscampus.ai and mlscampus.com; set them as **user-level** OS env vars (`setx`), restart the Claude Code session, and verify both servers list tools and can read a post. **Fallback:** the app itself calls NovaMira as a plain `POST {tool, arguments}` with a Bearer token (`src/lib/wordpress/novamira.ts`) — if Claude Code's MCP handshake fails against the endpoint, skip `.mcp.json` and do all WordPress verification in this playbook via `curl` with that same envelope. ✅ After this step: Claude can read (and later create/delete) posts on both sites — or the curl fallback is proven working.

**PROMPT GL-04** — Project: WordPress Social Autopilot. **Point the app at dev WordPress.** Set real values in `.env` → Netlify (Update conflicts) → redeploy: `WORDPRESS_SITE_URL=https://dev.mlscampus.ai`, `NOVAMIRA_MCP_URL` + `NOVAMIRA_MCP_TOKEN` = the **dev** site's NovaMira endpoint/token. Then configure the **dev** site's webhook sender (WordPress side): on publish, POST the post payload (`wpPostId`, `title`, `content`, `excerpt`, `featuredImageUrl`, `url`, `categories`, `tags`) to `https://wordpress-social-autopilot.netlify.app/api/webhooks/wordpress` with header `x-wsa-signature: sha256=<hex HMAC-SHA256 of the raw body, key = WEBHOOK_SECRET>`. 📋 Doc-check the NovaMira/webhook plugin's own settings screen for the exact field names. ✅ After this step: the app's env targets dev WP; the dev site signs and sends publish webhooks to Netlify.

**PROMPT GL-05** — Project: WordPress Social Autopilot. **End-to-end smoke: webhook → backfill → generation (no publishing yet).** Create a short test post on dev.mlscampus.ai (via the `wordpress-dev` MCP, or manually) with a title, body, and featured image. Verify in order: (1) webhook received — a new post row appears (dashboard list or `GET /api/posts`); (2) if the payload was partial, NovaMira backfill completed (`sourceComplete`); (3) run one worker tick (`curl … /api/worker/tick`) → Claude generates content for **all six platforms**, visible on the post's detail page with per-platform char counts and statuses (`PENDING` × LinkedIn/FB/IG/X, `MANUAL_REQUIRED` × YouTube/TikTok — nothing is connected, so nothing can publish). (4) Delete the WP test post. ✅ After this step: the full pipeline works up to (but not including) publishing, on real infrastructure with real generation.

**PROMPT GL-06** — Project: WordPress Social Autopilot. **Checkpoint A (gate).** Confirm every box: real `ANTHROPIC_API_KEY` / `WEBHOOK_SECRET` / `CRON_SECRET` live on Netlify · tick endpoint 401/200 (never 503) · MCP (or curl fallback) works for **both** WP sites · dev webhook delivers signed payloads · generation produced six platform drafts on a real post · test post cleaned up. Produce a one-screen status table. ✅ After this step: the foundation is green — platform phases may begin. **Do not proceed to Phase B until every box is checked.**

---

## Phase B — LinkedIn (easiest full publish; validates the whole pipeline)

**PROMPT GL-07** — Project: WordPress Social Autopilot. **LinkedIn app setup (user drives console, Claude gives exact steps).** 📋 Doc-check https://developer.linkedin.com first. Create an app at developer.linkedin.com (company: MLSCampus's LinkedIn Page), then add BOTH products — **"Sign In with LinkedIn using OpenID Connect"** and **"Share on LinkedIn"** (both instant self-serve; they grant the code's scopes `openid profile w_member_social`). Under Auth, add redirect URL exactly `https://wordpress-social-autopilot.netlify.app/api/oauth/linkedin/callback`. Collect Client ID + Client Secret. ✅ After this step: the LinkedIn app exists with both products and the exact redirect URL; credentials are in hand (not pasted into chat).

**PROMPT GL-08** — Project: WordPress Social Autopilot. **LinkedIn env + connect.** Put real `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` in `.env` → Netlify import (Update conflicts) → redeploy. Then on `https://wordpress-social-autopilot.netlify.app/connections`, click **Connect** on LinkedIn and complete the consent as the MLSCampus member account. Verify the tile shows **Connected** (member URN resolved and stored; token ~60 days). Leave auto-publish OFF. ✅ After this step: LinkedIn is CONNECTED in the dashboard with a real encrypted token.

**PROMPT GL-09** — Project: WordPress Social Autopilot. **LinkedIn real publish + cleanup.** Create a dev-WP test post (MCP) → webhook fires → tick once to generate → open the post in the dashboard, review the LinkedIn draft (≤3000 chars, backlink present), **Approve** it → tick again → verify: dashboard shows **PUBLISHED**, the audit log has the LinkedIn post id, and the post is live on the MLSCampus LinkedIn feed with working backlink. Then **delete the LinkedIn post** (⋯ menu on the post) and delete the WP test post. ✅ After this step: a real LinkedIn publish round-tripped and was cleaned up.

**PROMPT GL-10** — Project: WordPress Social Autopilot. **Checkpoint B — LinkedIn (gate).** Boxes: app has both products · redirect URI exact · CONNECTED · real publish verified (dashboard PUBLISHED + audit id + live post seen) · test posts deleted · noted for ops: LinkedIn tokens last ~60 days with **no refresh** — when the tile shows *Token expired*, the fix is Reconnect. ✅ After this step: LinkedIn is 100% functional. **Gate: do not start Phase C until all boxes are checked.**

---

## Phase C — X / Twitter

**PROMPT GL-11** — Project: WordPress Social Autopilot. **X developer account + app.** 📋 Doc-check https://developer.x.com (tiers and write limits change often — record what the current free/basic tier allows for `POST /2/tweets`). Sign up / sign in at developer.x.com with the MLSCampus X account, create a Project + App, and in **User authentication settings** enable OAuth 2.0 (Confidential client, type "Web App"), callback URI exactly `https://wordpress-social-autopilot.netlify.app/api/oauth/x/callback`, website = the Netlify URL. The app uses PKCE + scopes `tweet.read tweet.write users.read offline.access`. Collect the OAuth 2.0 Client ID + Client Secret. ✅ After this step: the X app exists with OAuth 2.0 configured and the exact callback; current tier's write allowance is recorded.

**PROMPT GL-12** — Project: WordPress Social Autopilot. **X env + connect.** Real `X_CLIENT_ID` / `X_CLIENT_SECRET` → `.env` → Netlify (Update conflicts) → redeploy. Connect X on `/connections` as the MLSCampus account; verify **Connected**. Note: X tokens last ~2h but the app holds a refresh token (rotating) — expiry self-heals. ✅ After this step: X is CONNECTED with access + refresh tokens stored.

**PROMPT GL-13** — Project: WordPress Social Autopilot. **X real publish + cleanup.** Dev-WP test post → webhook → tick → review the X draft (must fit 280 chars including the link) → **Approve** → tick → verify PUBLISHED + audit tweet id + tweet live on the MLSCampus profile. Delete the tweet, delete the WP test post. If the API returns a 403/402-style tier error instead, capture the exact error body (secret-free) for GL-14. ✅ After this step: a real tweet round-tripped and was cleaned up — or the tier limitation is precisely documented.

**PROMPT GL-14** — Project: WordPress Social Autopilot. **Checkpoint C — X (gate with escape hatch).** Boxes: OAuth app configured · CONNECTED · publish verified + cleaned up. **Escape hatch:** if `POST /2/tweets` is blocked by the account's API tier (payment required), either (a) upgrade the tier and re-run GL-13, or (b) **explicitly mark X as "deferred — tier"** in the checklist and proceed; the connection itself stays valid and publishing will work as soon as the tier allows. This is the only permitted way to pass a phase without a verified publish. ✅ After this step: X is 100% functional **or** formally deferred with a documented reason. **Gate for Phase D.**

---

## Phase D — Facebook (Meta app, dev mode)

**PROMPT GL-15** — Project: WordPress Social Autopilot. **Meta app setup (serves Facebook AND Instagram).** 📋 Doc-check https://developers.facebook.com/docs (Graph v25.0 in code). Prerequisites to verify first: the user is an **admin of the MLSCampus Facebook Page**, and will be an **admin of the Meta app** — in Development Mode, app-admins can use all the code's scopes (`pages_show_list pages_manage_posts pages_read_engagement business_management instagram_basic instagram_content_publish`) **without App Review**. Create the app at developers.facebook.com (type Business), add **Facebook Login** (or "Facebook Login for Business"), and set Valid OAuth Redirect URIs to BOTH `https://wordpress-social-autopilot.netlify.app/api/oauth/facebook/callback` and `.../api/oauth/instagram/callback` (one app serves both phases). Collect App ID + App Secret. **Caveat:** the app's callback stores the FIRST page returned by `/me/accounts` — if the user admins several Pages, grant the app access to only the MLSCampus Page during consent. ✅ After this step: the Meta app exists in dev mode with both redirect URIs; credentials in hand.

**PROMPT GL-16** — Project: WordPress Social Autopilot. **Facebook env + connect.** Real `META_APP_ID` / `META_APP_SECRET` → `.env` → Netlify (Update conflicts) → redeploy. Connect **Facebook** on `/connections`; in the Meta consent, select the MLSCampus Page only. Verify **Connected** (the app exchanged for a long-lived Page token and stored `fbPageId`). ✅ After this step: Facebook is CONNECTED against the right Page.

**PROMPT GL-17** — Project: WordPress Social Autopilot. **Facebook real publish + cleanup.** Dev-WP test post → webhook → tick → review the Facebook draft (≤500 chars + link) → **Approve** → tick → verify PUBLISHED + audit post id + the post live on the MLSCampus Page feed. Delete the Page post, delete the WP test post. ✅ After this step: a real Facebook Page publish round-tripped and was cleaned up.

**PROMPT GL-18** — Project: WordPress Social Autopilot. **Checkpoint D — Facebook (gate).** Boxes: Meta app in dev mode with user as admin · both redirect URIs registered · CONNECTED with correct `fbPageId` · publish verified + cleaned up · noted for ops: Meta Page tokens are long-lived with **no refresh** — expiry means Reconnect; taking the app out of dev mode later (public users) would require App Review, which this single-owner deployment does not need. ✅ After this step: Facebook is 100% functional. **Gate for Phase E.**

---

## Phase E — Instagram (same Meta app + Business account + image)

**PROMPT GL-19** — Project: WordPress Social Autopilot. **Instagram prerequisites + connect.** 📋 Doc-check https://developers.facebook.com/docs/instagram-platform (content publishing). Verify the MLSCampus Instagram account is a **Business (or Creator) account linked to the MLSCampus Facebook Page** (Page settings → Linked accounts) — fix that first if not. No new credentials needed (GL-15's app). Connect **Instagram** on `/connections`; the callback re-uses the Meta login and additionally resolves `instagram_business_account` → stores `igUserId`. Verify **Connected**. ✅ After this step: Instagram is CONNECTED with a resolved `igUserId`.

**PROMPT GL-20** — Project: WordPress Social Autopilot. **Instagram real publish + cleanup (image required).** Create the dev-WP test post **with a featured image** (the publisher posts it via the two-step container API; a post without one is held `MANUAL_REQUIRED` by design — verify that negative path too if convenient). Webhook → tick → review the IG draft (≤2200-char caption) → **Approve** → tick → verify PUBLISHED + audit media id + the image post live on the MLSCampus IG profile. Note the platform quota: 25 API posts per 24h. Delete the IG post, delete the WP test post. ✅ After this step: a real Instagram publish (with image) round-tripped and was cleaned up.

**PROMPT GL-21** — Project: WordPress Social Autopilot. **Checkpoint E — Instagram (gate).** Boxes: IG Business account linked to the Page · CONNECTED with `igUserId` · image publish verified + cleaned up · behavior understood: no featured image ⇒ `MANUAL_REQUIRED` (not an error), 25/24h quota ⇒ non-retryable failure at the limit · token ops same as Facebook (reconnect on expiry). ✅ After this step: Instagram is 100% functional. **Gate for Phase F.**

---

## Phase F — YouTube (connect-only by design)

**PROMPT GL-22** — Project: WordPress Social Autopilot. **Google OAuth client + connect.** 📋 Doc-check https://console.cloud.google.com (OAuth consent). Create/reuse a Google Cloud project → configure the OAuth consent screen (External, **Testing** status, add the MLSCampus Google account as a test user — no verification needed) → enable the YouTube Data API v3 → create an OAuth Client ID (Web application) with redirect URI exactly `https://wordpress-social-autopilot.netlify.app/api/oauth/youtube/callback`. Real `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` → `.env` → Netlify (Update conflicts) → redeploy → Connect **YouTube** on `/connections` (scope is read-only; consent shows "Testing" warning — expected). Verify **Connected** with a refresh token (offline access). ✅ After this step: YouTube is CONNECTED.

**PROMPT GL-23** — Project: WordPress Social Autopilot. **Checkpoint F — YouTube (gate; MANUAL_REQUIRED *is* the success state).** Dev-WP test post → webhook → tick → verify the YouTube item is generated and lands as **MANUAL_REQUIRED** (the public YouTube Data API has no community-post endpoint — the app holds YouTube content for manual posting in YouTube Studio, by design). Confirm the dashboard copy communicates this, then delete the WP test post. Boxes: consent screen in Testing with test user · CONNECTED · generated content reaches MANUAL_REQUIRED · cleanup done. ✅ After this step: YouTube behaves exactly as designed. **Gate for Phase G.**

---

## Phase G — TikTok (hardest: domain verification, unaudited drafts)

**PROMPT GL-24** — Project: WordPress Social Autopilot. **TikTok developer app.** 📋 Doc-check https://developers.tiktok.com (Login Kit + Content Posting API — requirements shift often). Create an app at developers.tiktok.com, add **Login Kit** and **Content Posting API** products, request the code's scopes (`user.info.basic`, `video.publish`, `video.upload`), set redirect URI exactly `https://wordpress-social-autopilot.netlify.app/api/oauth/tiktok/callback`, and complete any required **URL/domain verification** for the Netlify origin (this can take time — start it now and pause the phase if review is pending). Collect Client Key + Client Secret. **Expectation-setting:** until the app passes TikTok's content audit, posts created via API land as **private drafts in the account's inbox** — that is this phase's success state. ✅ After this step: the TikTok app exists with products, scopes, verified domain, and the exact redirect URI.

**PROMPT GL-25** — Project: WordPress Social Autopilot. **TikTok env + connect.** Real `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` → `.env` → Netlify (Update conflicts) → redeploy. Connect **TikTok** on `/connections` as the MLSCampus account (PKCE flow; scopes are comma-delimited in the authorize URL — already handled by the code). Verify **Connected** (open_id stored; refresh token present). ✅ After this step: TikTok is CONNECTED.

**PROMPT GL-26** — Project: WordPress Social Autopilot. **Checkpoint G — TikTok (gate; success = private inbox draft).** Dev-WP test post **with featured image** (the publisher sends a PHOTO post pulled from the image URL; no image ⇒ `MANUAL_REQUIRED`) → webhook → tick → **Approve** → tick → verify: dashboard **PUBLISHED** + audit `publish_id`, and in the TikTok mobile app the item appears as a **private draft in the inbox** (not on the public profile — expected for unaudited apps). Discard the draft, delete the WP test post. Boxes: domain verified · CONNECTED · draft round-trip verified · cleanup done · optional follow-up documented: apply for TikTok's content audit to enable direct public posting. ✅ After this step: TikTok is functional to the maximum an unaudited app allows. **Gate for Phase H.**

---

## Phase H — Go live (hands-off worker + switch to mlscampus.com)

**PROMPT GL-27** — Project: WordPress Social Autopilot. **Scheduled worker tick (GitHub Actions).** Add `.github/workflows/worker-tick.yml` to the repo: a `schedule: "*/5 * * * *"` (+ `workflow_dispatch`) workflow whose single step curls `https://wordpress-social-autopilot.netlify.app/api/worker/tick` with `Authorization: Bearer ${{ secrets.CRON_SECRET }}` and fails on non-200. User adds `CRON_SECRET` as an Actions secret on `AhseneRemmouche/wordpress-social-autopilot`. Commit + push, run it once via workflow_dispatch, and verify a green run + a 200 tick. 📋 Doc-check GitHub Actions `schedule` (min interval 5 min; delays possible). ✅ After this step: publishing no longer needs manual curls — the queue ticks every ~5 minutes.

**PROMPT GL-28** — Project: WordPress Social Autopilot. **Switch the app to the LIVE WordPress site (gated).** Preconditions (verify, don't assume): Checkpoints A–G all green (or X formally deferred) · **auto-publish OFF on every platform** · the team knows real posts will now flow. Then: `.env` → Netlify (Update conflicts) → redeploy with `WORDPRESS_SITE_URL=https://mlscampus.com` and the **live** site's `NOVAMIRA_MCP_URL` / `NOVAMIRA_MCP_TOKEN`; configure the live site's webhook sender exactly as GL-04 (same `WEBHOOK_SECRET`, same signed POST to the Netlify URL); disable/remove the dev site's webhook sender so both sites don't feed one app. Verify with the next real mlscampus.com publish (or one immediately-unpublished test): webhook lands, six drafts generate, and a human **reviews + approves** the first live posts manually. ✅ After this step: the app runs against the live site, human-in-the-loop.

**PROMPT GL-29** — Project: WordPress Social Autopilot. **Final checkpoint — full-system matrix + docs.** Produce the final verification matrix: per platform — connected? · publish verified (date)? · deferred/manual states documented? · token-expiry runbook (who reconnects, how) — plus worker (Actions cron green), webhook (live site signing), MCP (both sites reachable). Append a short `## 10. Go-live runbook` section to `docs/deployment.md` recording: the platform matrix, the Actions cron, dev→live switch procedure, and per-platform reconnect notes. Commit + push. Decide (deliberately, per platform) whether to flip any auto-publish toggles ON. ✅ After this step: the system is live, documented, and the go-live playbook is complete.
