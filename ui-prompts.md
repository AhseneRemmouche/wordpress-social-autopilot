# UI-PROMPTS — WordPress Social Autopilot (User Interface)

Paste-one-at-a-time prompts to build out and deploy the **user interface**, on top
of the already-shipped backend + basic UI. Same workflow as `ALL-PROMPTS.md`: run
each in order, let the checks pass, confirm the `✅` line, then move on.

**Chosen direction**
- **Hand-rolled Tailwind** design system (no component library — extends current code).
- **Light + dark mode** (theme tokens + toggle, SSR-safe, no FOUC).
- **Enhance the existing pages in place** — `/signin`, `(dashboard)/layout`,
  `/dashboard`, `/posts/[postId]`, `/connections` — reusing what works.

**Standing constraints (every prompt obeys these)**
- Next.js 16.2.9 App Router · TypeScript 6.0.3 strict (no `any`, explicit return
  types, `noUncheckedIndexedAccess`) · Tailwind CSS 4.3.2 **CSS-first** (`@theme`
  in `src/app/globals.css`, no `tailwind.config.js`).
- Reuse existing API routes — `GET /api/posts`, `GET /api/posts/[postId]`,
  `POST /api/content/[contentId]/{approve,reject,retry}`,
  `PATCH /api/settings/auto-publish`, `GET|DELETE /api/connections`,
  `GET /api/oauth/[platform]/start`. Don't change API contracts.
- Server Components by default; `"use client"` only for interactivity. No secrets
  in the client. Accessibility (focus, keyboard, aria, contrast) is not optional.
- New UI primitives live in `src/components/ui/`; feature components stay in
  `src/components/`.
- End every prompt by running `npm run lint`, `npm run typecheck`, `npm test`
  (and `npm run build` at checkpoints) and reporting a `✅` summary.

**Doc-check policy** — before using a framework feature, confirm it against
official docs and note the source: Tailwind 4 `@theme` + `@custom-variant` dark
mode, `next/font`, the native `<dialog>` element, React Testing Library + jsdom.

---

## Phase U0 — Foundations (tokens, dark mode, fonts)

**PROMPT UI-01** — Project: WordPress Social Autopilot. In `src/app/globals.css`, define the design-system **tokens** with Tailwind 4 `@theme`: semantic colors (`--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-muted`, `--color-primary`, `--color-success`, `--color-warning`, `--color-danger`) plus the six platform accents, a radius scale, and shadow tokens — light values as the default. Map the existing `neutral-*` usage onto these tokens conceptually (don't rip out styles yet). 📋 Doc-check the Tailwind 4 `@theme` syntax. ✅ After this step: tokens compile; `npm run build` succeeds.

**PROMPT UI-02** — Project: WordPress Social Autopilot. Add **dark-mode infrastructure**: a Tailwind 4 `@custom-variant dark (&:where(.dark, .dark *))` and a `.dark { … }` block overriding the semantic color tokens from UI-01. Read a `theme` cookie in the root `layout.tsx` (Server Component) and set `class="dark"` on `<html>` so the SSR HTML already matches (no FOUC); default to `light` when unset. 📋 Doc-check Tailwind 4 custom variants + dark mode. ✅ After this step: forcing the cookie renders a dark page server-side with no flash.

**PROMPT UI-03** — Project: WordPress Social Autopilot. Wire **fonts + base typography** via `next/font` in the root `layout.tsx` (a clean UI sans, e.g. Inter/Geist), expose it as a CSS variable, and set base body/heading styles + sensible defaults (antialiasing, `text-balance` on headings) in `globals.css` using the tokens. ✅ After this step: typography is consistent app-wide in light and dark.

**PROMPT UI-04** — Project: WordPress Social Autopilot. Implement `src/components/ui/ThemeToggle.tsx` (client): an accessible switch/button that flips light⇄dark, writes the `theme` cookie, and toggles `.dark` on `<html>` immediately (optimistic, no reload). Respect `prefers-color-scheme` on first visit. ✅ After this step: toggling persists across reloads with no flash; keyboard-operable.

---

## Phase U1 — Primitives (`src/components/ui/`)

**PROMPT UI-05** — Project: WordPress Social Autopilot. Create `Button.tsx` + `IconButton.tsx`: variants (`primary` / `secondary` / `ghost` / `danger`), sizes (`sm` / `md`), a `loading` state (spinner + disabled), `leftIcon`/`rightIcon`, full `focus-visible` ring, token-driven light/dark styles. Typed props extend `ButtonHTMLAttributes`. ✅ After this step: buttons render in all variants/states; typecheck + lint clean.

**PROMPT UI-06** — Project: WordPress Social Autopilot. Create `Card.tsx` (surface + border + radius + optional padding) and `SectionHeader.tsx` (title + optional description + right-aligned actions slot), token-driven. ✅ After this step: a demo composition renders in light/dark.

**PROMPT UI-07** — Project: WordPress Social Autopilot. Create a base `Badge.tsx` (tone: `neutral`/`success`/`warning`/`danger`/`info`, size), then refactor `StatusBadge.tsx` to render via `Badge` — keeping its `Record<ContentStatus,…>` exhaustiveness. Update `ConnectionStatus.tsx` similarly. ✅ After this step: badges are consistent; existing tests still pass.

**PROMPT UI-08** — Project: WordPress Social Autopilot. Create form field primitives — `Label.tsx`, `Input.tsx`, `Select.tsx`, `Textarea.tsx`, `HelperText.tsx` — with error state, focus ring, and dark tokens (used by filters/search and future settings). ✅ After this step: fields render + are accessible (label association).

**PROMPT UI-09** — Project: WordPress Social Autopilot. Extract the switch UI from `AutoPublishToggle.tsx` into a reusable `Switch.tsx` (`role="switch"`, `aria-checked`, keyboard, disabled, sizes), then refactor `AutoPublishToggle` to use it (behavior unchanged). ✅ After this step: `auto-publish.test.ts` and the toggle still work.

**PROMPT UI-10** — Project: WordPress Social Autopilot. Create feedback primitives — `Spinner.tsx`, `Skeleton.tsx` (shimmer, respects reduced-motion), `EmptyState.tsx` (icon + title + description + optional action). ✅ After this step: each renders standalone in light/dark.

**PROMPT UI-11** — Project: WordPress Social Autopilot. Implement a hand-rolled **toast system**: `ToastProvider.tsx` (context + portal + auto-dismiss + `success`/`error`/`info` variants, stacked, dismissible, `aria-live`) and a `useToast()` hook. Mount the provider in `(dashboard)/layout.tsx`. No new deps. ✅ After this step: a temporary trigger shows/auto-dismisses a toast; screen-reader announced.

**PROMPT UI-12** — Project: WordPress Social Autopilot. Implement `ConfirmDialog.tsx` — an accessible modal (native `<dialog>` or a focus-trapped overlay) with title, body, confirm/cancel, `Escape` to close, focus restore, and a `danger` confirm variant. 📋 Doc-check the native `<dialog>` element. ✅ After this step: a demo confirm opens/closes via mouse + keyboard and traps focus.

---

## Phase U2 — App shell & navigation

**PROMPT UI-13** — Project: WordPress Social Autopilot. Rebuild `(dashboard)/layout.tsx` into a responsive **app shell**: a sidebar (Dashboard / Connections with icons + active state), a top bar (page-title slot, `ThemeToggle`, user menu), and a collapsible mobile drawer. Keep the server-side owner-session guard. Token-driven, dark-aware. ✅ After this step: shell is responsive (sidebar ≥ md, drawer < md) and keyboard-navigable.

**PROMPT UI-14** — Project: WordPress Social Autopilot. Add route boundaries for the dashboard segment and post detail: `loading.tsx` (Skeleton layouts), `error.tsx` (friendly message + retry, client), and `not-found.tsx`. ✅ After this step: throttling/erroring a route shows the right state, not a blank page.

**PROMPT UI-15** — Project: WordPress Social Autopilot. Implement `UserMenu.tsx` (client): avatar/initials from the GitHub login, a menu with **Sign out** (NextAuth `signOut`) and the `ThemeToggle` (on mobile). Accessible menu (roving focus, `Escape`, outside-click). ✅ After this step: sign-out works; menu is keyboard-operable.

---

## Phase U3 — Sign-in

**PROMPT UI-16** — Project: WordPress Social Autopilot. Polish `(auth)/signin/page.tsx`: a branded, centered card (dark-aware), the GitHub button with a `loading` state on click, a friendly error message when NextAuth returns `?error=`, and reduced-motion-safe entrance. Owner-only copy stays. ✅ After this step: sign-in looks intentional in light/dark; error path renders.

---

## Phase U4 — Dashboard (post list)

**PROMPT UI-17** — Project: WordPress Social Autopilot. Add a dashboard **toolbar** (client): status filter (All / Pending / Approved / Published / Failed / Manual), platform filter, and a title search, with state synced to the URL query (`?status=&platform=&q=`). ✅ After this step: filters/search update the list and survive refresh via the URL.

**PROMPT UI-18** — Project: WordPress Social Autopilot. Enhance `PostList.tsx` / `PostRow.tsx` using the primitives: responsive rows, per-platform status chips (`StatusBadge`), relative "received" time, hover/active + `focus-visible`, and a polished empty state. Rows link to `/posts/[id]`. ✅ After this step: the list reads cleanly at sm/md/lg in both themes.

**PROMPT UI-19** — Project: WordPress Social Autopilot. Enhance `PostsFeed.tsx`: `Skeleton` on first load, apply the UI-17 filters client-side to the polled data, a subtle "updated just now" indicator on refresh, and the empty state when filters match nothing. Keep the 5s poll + abort/cleanup. ✅ After this step: statuses update live and filtering is instant.

**PROMPT UI-20** — Project: WordPress Social Autopilot. Add a **summary strip** above the list: cards counting items needing attention (Pending to review, Failed to retry, Manual required), each linking to its filtered view. Server-computed initial counts, refreshed by the feed. ✅ After this step: the strip reflects real counts and deep-links into filters.

---

## Phase U5 — Post review detail

**PROMPT UI-21** — Project: WordPress Social Autopilot. Enhance `(dashboard)/posts/[postId]/page.tsx`: a sticky header (title, external post link, back), a responsive grid of `PlatformPreviewCard`s, and `loading`/`not-found` states. ✅ After this step: the detail view is scannable and responsive.

**PROMPT UI-22** — Project: WordPress Social Autopilot. Enhance `PlatformPreviewCard.tsx`: a **character-count meter** (count vs the platform limit, with a near/over-limit color), styled hashtags, a "needs featured image" hint for media-required platforms, the status badge, and Approve/Reject via the content routes with **toast feedback + optimistic status**. Buttons disable during in-flight and on non-PENDING. ✅ After this step: approve/reject show toasts and update the card without a full reload.

**PROMPT UI-23** — Project: WordPress Social Autopilot. Gate **Reject** behind `ConfirmDialog` (destructive), and enhance `RetryButton.tsx` with a spinner + success/error toast. Both reflect the resulting status. ✅ After this step: reject asks for confirmation; retry gives clear feedback.

**PROMPT UI-24** — Project: WordPress Social Autopilot. (Optional) Add an **"Approve all pending"** action for a post: a confirm, then sequential/parallel calls to the approve route with per-platform result toasts and a progress indicator; isolate failures. ✅ After this step: bulk-approve works and reports per-platform outcomes.

---

## Phase U6 — Connections

**PROMPT UI-25** — Project: WordPress Social Autopilot. Enhance `(dashboard)/connections/page.tsx`: a section intro, a grid of `ConnectionCard`s, and a **TOKEN_EXPIRED alert banner** at the top summarizing any platforms needing reconnect (SC-008). ✅ After this step: expired platforms are surfaced prominently, never silently.

**PROMPT UI-26** — Project: WordPress Social Autopilot. Enhance `ConnectionCard.tsx`: platform icon + label, status pill, expiry detail, and Connect/Reconnect (OAuth start) / Disconnect (confirm + toast) actions, plus the auto-publish `Switch` with capability hints (YouTube = manual-only, TikTok = draft-until-audited, Instagram = needs image). ✅ After this step: each platform's state and capabilities read clearly.

**PROMPT UI-27** — Project: WordPress Social Autopilot. Handle the **OAuth return**: on `/connections?connected=<slug>` or `?error=<code>`, show a success/error toast and strip the query from the URL (no reload). ✅ After this step: returning from a provider gives clear feedback.

---

## Phase U7 — Cross-cutting polish

**PROMPT UI-28** — Project: WordPress Social Autopilot. **Accessibility pass**: `focus-visible` rings everywhere, correct roles/aria on menus/dialogs/switches/toasts, full keyboard nav, `prefers-reduced-motion`, and a light+dark color-contrast check (fix any AA failures). ✅ After this step: keyboard-only navigation works across every page; contrast passes AA.

**PROMPT UI-29** — Project: WordPress Social Autopilot. **Responsive pass**: verify and fix the shell, dashboard, detail, and connections at sm/md/lg (drawer nav, stacked cards, tappable targets). ✅ After this step: no horizontal scroll or clipped controls on mobile.

**PROMPT UI-30** — Project: WordPress Social Autopilot. **Motion & micro-interactions**: consistent transition tokens, skeleton shimmer, toast slide-in, button/press feedback — all gated by `prefers-reduced-motion`. ✅ After this step: interactions feel cohesive and are reduced-motion-safe.

**PROMPT UI-31** — Project: WordPress Social Autopilot. **State consistency**: ensure every data view has a Skeleton loading state, an EmptyState, and an error state; unify their look. ✅ After this step: no raw blank/loading gaps remain.

---

## Phase U8 — UI testing

**PROMPT UI-32** — Project: WordPress Social Autopilot. Add **UI test infra**: install `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and `jsdom` (dev). Configure Vitest to run component tests under a jsdom environment (per-file `// @vitest-environment jsdom` or a `tests/ui` project) and wire jest-dom matchers in setup. 📋 Doc-check RTL + Vitest jsdom setup. ✅ After this step: a trivial render test passes; the node-env suite is unaffected.

**PROMPT UI-33** — Project: WordPress Social Autopilot. Add `tests/ui/primitives.test.tsx`: Button (variants/loading/disabled), Switch (toggle + `aria-checked` + keyboard), Toast (show + auto-dismiss + dismiss), ConfirmDialog (confirm/cancel/Escape + focus trap), Badge/StatusBadge. Principle VII. ✅ After this step: primitive tests pass.

**PROMPT UI-34** — Project: WordPress Social Autopilot. Add `tests/ui/flows.test.tsx` (mock `fetch` + `next/navigation`): PlatformPreviewCard approve/reject (toast + optimistic), RetryButton, AutoPublishToggle (PATCH + revert on error), ConnectionCard disconnect (confirm → DELETE → toast). Principle VII. ✅ After this step: interaction flows pass.

**PROMPT UI-35** — Project: WordPress Social Autopilot. Add `tests/ui/theme-and-filters.test.tsx`: ThemeToggle flips `.dark` + persists the cookie; the dashboard toolbar filters/search narrow the rendered list and sync to the URL. ✅ After this step: theming + filtering are covered; `npm run test:ci` stays green (adjust coverage config to include `.tsx` if desired).

---

## Phase U9 — Deployment

**PROMPT UI-36** — Project: WordPress Social Autopilot. **Build + bundle check**: `npm run build`; confirm the route manifest, that client bundles carry no server-only code/secrets, and that `"use client"` is only where needed. Fix any warnings or oversized client chunks. ✅ After this step: production build is clean and the client boundary is tight.

**PROMPT UI-37** — Project: WordPress Social Autopilot. **Vercel project**: connect the repo, set the env vars from `docs/deployment.md` (incl. `CRON_SECRET` for the tick cron), and enable preview deployments on PRs. Note: the **queue worker does not run on Vercel** — use `vercel.json`'s cron → `/api/worker/tick`, or run the worker container elsewhere. ✅ After this step: a preview URL builds and serves the UI.

**PROMPT UI-38** — Project: WordPress Social Autopilot. **Lighthouse / budget**: run Lighthouse (or `@lhci`) on `/signin`, `/dashboard`, `/posts/[id]`, `/connections`; hit Performance/Accessibility/Best-Practices targets, verify dark mode + reduced motion, and fix regressions (CLS, contrast, focus order). ✅ After this step: pages meet the agreed budget with no a11y errors.

**PROMPT UI-39** — Project: WordPress Social Autopilot. **UI checkpoint vs `quickstart.md`**: on the preview deploy, walk the owner journey — sign in → dashboard (live list + filters) → review a post → approve/reject/retry → connections (connect/disconnect/auto-publish, expiry alert) → theme toggle — and confirm each scenario visually in light + dark. Fix issues. ✅ After this step: every quickstart UI scenario passes on the preview.

**PROMPT UI-40** — Project: WordPress Social Autopilot. **Production deploy**: promote to production, smoke-test the live UI (auth, data loads, one action end-to-end), confirm env + API wiring, and record the production URL in `README.md`. ✅ After this step: the UI is live and verified in production.
