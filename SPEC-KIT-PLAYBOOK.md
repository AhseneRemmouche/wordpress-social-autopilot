# SPEC-KIT-PLAYBOOK.md — wordpress-social-autopilot

> **Start here.** This is the master bootstrap for building **wordpress-social-autopilot** with **Spec-Driven Development (Spec Kit)**. Work through Steps 0 → 8 in order. Do **not** write application code until Step 8.
>
> The pipeline is: **constitution → specify → clarify → plan → tasks → ALL-PROMPTS.md → implement.** Steps 1–6 produce the governing artifacts (`.specify/memory/constitution.md`, `spec.md`, `plan.md`, `research.md`, `tasks.md`); Step 7 generates **`ALL-PROMPTS.md`** (the per-task implementation recipe); Step 8 executes it.

---

## Project Overview

When I publish a post on my WordPress website, this app automatically:

1. Receives a webhook from WordPress.
2. Uses Claude AI to generate tailored content for each social media platform.
3. Embeds a link back to the WordPress post in each piece of content.
4. Publishes or queues that content across all platforms.

## Tech Stack

> **Version policy:** do **not** hardcode versions. Before writing code, check each library's official docs for the **latest stable version** and record the confirmed version in `research.md` (constitution §8).

- **Next.js** — https://nextjs.org/docs (App Router, TypeScript strict mode)
- **TypeScript** — https://www.typescriptlang.org/docs/
- **Zod** — https://zod.dev
- **Claude AI SDK** — `@anthropic-ai/sdk` — https://docs.anthropic.com
- **Prisma + PostgreSQL** — https://www.prisma.io/docs
- **NextAuth.js** — https://next-auth.js.org/getting-started/introduction
- **Tailwind CSS** — https://tailwindcss.com/docs
- **NovaMira MCP** — WordPress integration via the MCP protocol

## Social Media Platforms

| Platform    | API                        |
| ----------- | -------------------------- |
| LinkedIn    | LinkedIn API v2            |
| Instagram   | Meta Graph API             |
| Facebook    | Meta Graph API             |
| YouTube     | YouTube Data API v3        |
| X / Twitter | Twitter API v2             |
| TikTok      | TikTok Content Posting API |

---

> **IMPORTANT:** Before writing any code, follow these Spec Kit steps in order.

---

## STEP 0 — Install and Initialize Spec Kit

Install Spec Kit and initialize the project with Claude Code integration:

```bash
# Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Get the latest Spec Kit version from:
# https://github.com/github/spec-kit/releases
# Then install (replace vX.Y.Z with the latest version found on that page)
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z

# Initialize the project with Claude Code integration
specify init wordpress-social-autopilot --integration claude-code
cd wordpress-social-autopilot
```

✅ **After this step:** Spec Kit is installed and the project is initialized with the `.specify/` structure and the `/speckit.*` commands available in Claude Code.

---

## STEP 1 — Establish the Project Constitution

Use the `/speckit.constitution` command with this prompt:

```
/speckit.constitution

Create governing principles for wordpress-social-autopilot with the following
focus areas:

1. Code Quality
   - TypeScript strict mode always on
   - All external data validated with Zod schemas at runtime boundaries
   - No any types — every value must be explicitly typed
   - Functions must be small, single-purpose, and testable

2. Security Standards
   - All webhook payloads must be signature-verified before processing
   - OAuth tokens must be encrypted at rest in the database
   - Environment variables must be validated at startup using Zod
   - No secrets in code or logs

3. API Integration Principles
   - Each social media platform must have its own isolated publisher module
   - All API calls must handle rate limits, token expiry, and retry logic
   - Failed publishes must be logged with full error context and retried
     automatically
   - Publisher modules must be independently testable with mocked API responses

4. AI Content Generation
   - Claude AI prompts must be version-controlled as constants, not inline
     strings
   - All Claude AI responses must be validated with Zod before use
   - Platform-specific content must respect character limits, tone, and format
     rules
   - Every generated piece of content must include a link back to the
     WordPress post

5. Database Principles
   - Prisma schema is the single source of truth for all data models
   - Every database operation must be wrapped in error handling
   - Audit logs must be written for every publish attempt, success, and failure

6. User Experience (Dashboard)
   - Dashboard must show real-time publish status per platform
   - Content must be previewable before publishing
   - Manual approval mode and auto-publish mode must be toggleable per platform

7. Testing Standards
   - Webhook receiver must have integration tests
   - All Zod schemas must have unit tests
   - Publisher modules must have unit tests with mocked API calls
   - Claude AI content generation must have tests with mocked API responses

8. Framework Version Policy
   - Before writing any implementation code, always check the official
     documentation for the latest stable version of each framework or library
     being used
   - Document the confirmed version in research.md before adding it to the
     project
```

✅ **After this step:** `.specify/memory/constitution.md` exists with the eight governing principle areas every later artifact must obey.

---

## STEP 2 — Create the Feature Specification

Use the `/speckit.specify` command with this prompt:

```
/speckit.specify

Build wordpress-social-autopilot, a Next.js automation hub that connects my
WordPress website to six social media platforms.

CORE WORKFLOW:
When I publish a new post on my WordPress website, the system should
automatically detect the new post via webhook, extract the post title, content,
excerpt, featured image URL, post URL, categories, and tags, then use Claude AI
to generate platform-specific social media content for each of the six
platforms, and publish or queue that content on each platform.

CONTENT GENERATION REQUIREMENTS:
Claude AI must generate unique content for each platform that matches the
platform's style, tone, character limits, and best practices. Every piece of
generated content must include a direct link back to the original WordPress
post. Content must be relevant to the WordPress post topic and not just a
generic summary.

PLATFORM-SPECIFIC RULES:
- LinkedIn: Professional tone, up to 3000 characters, 3-5 relevant hashtags,
  include post link with a call to action
- Instagram: Visual-first tone, up to 2200 characters, 10-15 hashtags, strong
  hook in first line, include post link in caption note since links are not
  clickable
- Facebook: Conversational tone, up to 63,206 characters but keep it under 500
  for engagement, 2-3 hashtags, include clickable post link
- YouTube: Write a community post or video description, up to 5000 characters,
  include timestamps if relevant, include post link
- X / Twitter: Punchy and direct, up to 280 characters, 1-2 hashtags, include
  shortened post link
- TikTok: Trendy and engaging tone, up to 2200 characters, 3-5 hashtags, hook
  in first line, include post link in bio note

DASHBOARD REQUIREMENTS:
There must be an admin dashboard where I can:
- See all incoming WordPress posts that triggered the automation
- Preview the generated content for each platform before it publishes
- Approve or reject generated content per platform
- Toggle auto-publish mode on or off per platform independently
- See the publish status of each piece of content (pending, approved,
  published, failed)
- Retry failed publishes manually
- Connect and disconnect each social media account via OAuth
- See connection status for each platform (connected, token expired,
  disconnected)

SOCIAL MEDIA ACCOUNT CONNECTION:
I must be able to connect my social media accounts to this app via OAuth 2.0.
The app must store the access tokens securely, refresh them automatically when
they expire, and alert me on the dashboard when a token has expired and needs
reconnection.

WORDPRESS INTEGRATION:
WordPress will send a webhook when a post is published. The webhook payload
must be verified using a shared secret signature. If the webhook payload is
missing any data, the app should use NovaMira MCP to fetch the full post data
directly from WordPress.

RELIABILITY REQUIREMENTS:
- All failed publish attempts must be logged with the error details
- Failed publishes must be automatically retried up to 3 times with exponential
  backoff
- The system must continue processing other platforms even if one platform
  fails
- All processing must be non-blocking so the webhook receiver responds
  immediately

NON-GOALS FOR THIS PHASE:
- No scheduling of future posts (publish immediately or queue for manual
  approval only)
- No multi-WordPress site support (single site only)
- No analytics or engagement tracking
- No AI image generation
```

✅ **After this step:** `spec.md` captures the full feature specification, platform rules, dashboard requirements, and non-goals.

---

## STEP 3 — Clarify the Specification

Use the `/speckit.clarify` command to surface gaps, then document the answers with this prompt:

```
/speckit.clarify

After running the structured clarification, also answer and document the
following:

1. What happens if Claude AI generates content that is over a platform's
   character limit? Should it truncate or regenerate?
2. What is the exact Prisma model structure for storing generated content —
   one row per platform per post, or one row per post with a JSON field?
3. What is the webhook secret verification method — HMAC-SHA256 signature in
   the request header?
4. For Instagram publishing, since Instagram Basic Display API does not support
   posting, confirm we are using the Instagram Graph API with a connected
   Facebook Business account.
5. For YouTube community posts, confirm the exact API endpoint and whether this
   requires a YouTube channel with 500+ subscribers.
6. What is the database schema for storing OAuth tokens — one table for all
   platforms with a platform identifier column, or separate tables per
   platform?
7. Should the dashboard require authentication? If yes, what provider does
   NextAuth.js use — email magic link, GitHub, or Google?
8. What is the retry strategy — immediate retry, fixed delay, or exponential
   backoff with jitter?

After clarifying, validate the Review and Acceptance Checklist in the spec and
check off every item that is satisfied.
```

> **Recommended answers (carried into `plan.md` and the companion specs):** (1) regenerate via a re-prompt that includes the validation error, max 2 retries, then truncate as a last resort; (2) **one `GeneratedContent` row per platform per post** (unique on `postId + platform`); (3) **HMAC-SHA256** signature in the `X-WSA-Signature` header, constant-time compared over the raw body; (4) **yes — Instagram Graph API** with a connected Facebook Business/Creator account; (5) confirm the community-post endpoint and channel eligibility in `research.md`, otherwise fall back to the video-description mode; (6) **one `PlatformAccount` table** for all platforms with a `platform` enum column; (7) **yes**, dashboard requires auth (single admin via NextAuth — choose the provider here and record it); (8) **exponential backoff with jitter**, up to 3 attempts.

✅ **After this step:** the spec's open questions are resolved and documented, and the Review & Acceptance Checklist is validated.

---

## STEP 4 — Generate the Technical Plan

Use the `/speckit.plan` command with this prompt:

```
/speckit.plan

Before writing the plan, check the official documentation websites for the
latest stable versions of each of the following and record the confirmed
versions in research.md:

- Next.js                  → https://nextjs.org/docs
- TypeScript               → https://www.typescriptlang.org/docs/
- Zod                      → https://zod.dev
- Prisma                   → https://www.prisma.io/docs
- NextAuth.js              → https://next-auth.js.org/getting-started/introduction
- Tailwind CSS             → https://tailwindcss.com/docs
- Anthropic SDK            → https://docs.anthropic.com
- LinkedIn API v2          → https://docs.microsoft.com/en-us/linkedin/
- Meta Graph API           → https://developers.facebook.com/docs/graph-api
- YouTube Data API v3      → https://developers.google.com/youtube/v3
- Twitter API v2           → https://developer.twitter.com/en/docs/twitter-api
- TikTok Content Posting   → https://developers.tiktok.com/doc/content-posting-api-get-started

Now create the technical implementation plan using this stack with the
confirmed versions (do NOT hardcode versions — use whatever latest stable
versions you recorded in research.md):
- Next.js (latest stable, App Router) with TypeScript strict mode
- Tailwind CSS for dashboard UI
- Prisma with PostgreSQL for data persistence
- NextAuth.js for dashboard authentication
- Anthropic SDK for Claude AI content generation
- NovaMira MCP for WordPress fallback data fetching
- Node.js native fetch for social media API calls
- All inputs/outputs validated with Zod

The plan must include:
1. Full folder and file structure for the Next.js App Router project
2. All Prisma models: WordPressPost, GeneratedContent, PublishJob,
   PlatformAccount, AuditLog
3. All API routes needed: webhook receiver, OAuth callbacks per platform,
   publish endpoints, dashboard data endpoints
4. The Claude AI service module design with per-platform prompt constants
5. The publisher module design — one isolated module per platform
6. The OAuth token management design — storage, encryption, refresh
7. The dashboard page structure and component hierarchy
8. The publish queue and retry logic design
9. All environment variables needed across all integrations
10. The NovaMira MCP integration pattern for fetching WordPress post data

After generating the plan, identify any areas where the framework or API
versions are rapidly changing and spawn parallel research tasks to clarify
those specific areas using the official documentation links above.
```

✅ **After this step:** `plan.md` (and supporting design files) plus a `research.md` with confirmed latest-stable versions and the fixed model names: `WordPressPost`, `GeneratedContent`, `PublishJob`, `PlatformAccount`, `AuditLog`.

---

## STEP 5 — Validate the Plan

After the plan is generated, send this prompt:

```
Audit the full implementation plan and all implementation detail files.
Check for:

1. Any missing steps in the implementation sequence
2. Any over-engineered components that add complexity without clear value —
   flag these and suggest simpler alternatives
3. Any steps that reference framework features or API endpoints that should be
   verified against the official docs
4. Any gaps between the spec requirements and what the plan covers
5. Verify the plan follows all principles in .specify/memory/constitution.md

After the audit, update the plan to fix any issues found and check off the
Review and Acceptance Checklist.
```

✅ **After this step:** the plan is audited against the constitution and spec, simplified where over-engineered, and its checklist is checked off.

---

## STEP 6 — Generate Task Breakdown

Use the `/speckit.tasks` command with this prompt:

```
/speckit.tasks

Generate a complete task breakdown from the implementation plan with the
following requirements:

- Group tasks by feature area:
    * Setup
    * WordPress Integration
    * Claude AI Integration
    * Per-Platform Content Generation (one group per platform)
    * Per-Platform Publishing (one group per platform)
    * OAuth Flows
    * Dashboard
    * Queue and Retry Logic
    * Testing
    * Deployment

- Mark tasks that can run in parallel with [P]
- Include the exact file path for every task
- Include test tasks immediately after each implementation task (test-first
  where possible)
- Include checkpoint validation tasks at the end of each feature group
- Each task must be small enough to complete in a single Claude Code session
```

✅ **After this step:** `tasks.md` lists every implementation task, grouped by feature area, with file paths, `[P]` parallel markers, test-first ordering, and checkpoints.

---

## STEP 7 — Generate ALL-PROMPTS.md

After `tasks.md` is generated, send this prompt:

```
Create ALL-PROMPTS.md at the project root. This file is a complete prompt
playbook for the entire implementation phase of this project. It must contain
one prompt per task from tasks.md, in the exact order tasks should be executed.

Each prompt must:
- Be labeled with the task number and title:
  ## PROMPT 01 — [Task Title]
- Be 100% self-contained with full context (project name, file paths, framework
  versions from research.md, relevant spec and plan references)
- Be ready to paste directly into Claude Code with no editing
- End with: ✅ After this step: [what file or feature now exists]
- Include a note if the task requires checking official documentation before
  implementation

Group prompts by the same feature areas used in tasks.md. At the top of
ALL-PROMPTS.md, include a table of contents with all prompt numbers and titles
so I can navigate the file easily.

This file is my step-by-step recipe to build the entire project by pasting one
prompt at a time.
```

> A worked, ready-to-use version of this artifact already lives at **`ALL-PROMPTS.md`** in this repo. Once `tasks.md` exists, regenerate or reconcile `ALL-PROMPTS.md` so its prompt order and task numbers mirror `tasks.md` exactly.

✅ **After this step:** `ALL-PROMPTS.md` is the paste-one-at-a-time implementation recipe, mirroring `tasks.md`.

---

## STEP 8 — Implementation

Once `ALL-PROMPTS.md` is ready and reviewed, run:

```
/speckit.implement
```

…or paste the prompts from `ALL-PROMPTS.md` one at a time, in order.

✅ **After this step:** the project is implemented per the plan — from webhook ingestion through Claude generation, the dashboard, and all six publishers — with tests along the way.

---

> **START NOW WITH STEP 0. Do not skip steps. Do not write application code until STEP 8.**
