# Feature Specification: WordPress Social Autopilot

**Feature Branch**: `001-social-autopilot`

**Created**: 2026-06-29

**Status**: Draft

**Input**: User description: "Build wordpress-social-autopilot, a Next.js automation hub that connects a WordPress website to six social media platforms (LinkedIn, Instagram, Facebook, YouTube, X/Twitter, TikTok). On WordPress post publish, a signature-verified webhook triggers extraction of post data, Claude AI generates platform-specific content with a backlink, and content is published or queued. Includes an admin dashboard for preview/approve/reject, per-platform auto-publish toggles, publish status, manual retry, OAuth connect/disconnect with token refresh. Uses NovaMira MCP to backfill missing webhook data. Reliability: log failures, auto-retry 3x with exponential backoff, continue on per-platform failure, non-blocking webhook. Non-goals: no scheduling, single WordPress site only, no analytics, no AI image generation."

## Clarifications

### Session 2026-06-29

- Q: When generated content exceeds a platform's character limit, truncate or regenerate? → A: Truncate only — hard-truncate to the limit at a word boundary, always preserving the post link.
- Q: How is generated content stored (one row per platform per post, or one row per post with a JSON field)? → A: One row per platform per post (normalized), so each platform has independent status, retries, and audit trail.
- Q: How are OAuth tokens stored (one table with a platform column, or separate tables per platform)? → A: One table for all platforms with a platform identifier column and encrypted token fields.
- Q: Should the dashboard require authentication, and via which provider? → A: Yes — authentication required, using a single sign-in provider (GitHub) restricted to the owner's account.
- Q: What webhook verification method is used? → A: HMAC-SHA256 signature sent in a request header, compared against the shared secret using a constant-time comparison.
- Q: How is Instagram publishing performed (given Basic Display API cannot post)? → A: Via the Instagram Graph API using a connected Facebook/Instagram Business account.
- Q: How are YouTube community posts published, and is a 500+ subscriber channel required? → A: The public YouTube Data API has no endpoint to create community posts; the 500-subscriber gate applies only to the manual UI feature. In this phase YouTube content is generated and held for manual posting (or attached as a video description); programmatic community posting is out of scope and to be confirmed in research.md.
- Q: What is the retry strategy for failed publishes? → A: Exponential backoff with jitter, up to 3 automatic retries before marking the item failed.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Auto-generate and publish social content on new WordPress post (Priority: P1)

When the site owner publishes a new post on their WordPress website, the system
automatically receives a notification, gathers the post's content, generates a
tailored social media message for each of the six connected platforms, and — for
platforms set to auto-publish — posts it immediately, each with a link back to the
original article. This is the core value of the product: turning one act of
publishing into six platform-appropriate promotions with no manual effort.

**Why this priority**: This is the central automation that justifies the product. On
its own it delivers the headline benefit — publish once, promote everywhere. Without
it, nothing else matters.

**Independent Test**: Publish a test post on the WordPress site (or simulate the
publish notification) and verify that distinct, platform-appropriate content is
generated for all six platforms, each containing a working link back to the post, and
that platforms set to auto-publish receive the content.

**Acceptance Scenarios**:

1. **Given** all six platforms are connected and set to auto-publish, **When** a new
   WordPress post is published, **Then** the system generates unique content for each
   platform within its character limit and posts it to all six, each including a link
   back to the original post.
2. **Given** a new WordPress post is published, **When** the system generates content,
   **Then** each platform's content respects that platform's tone, character limit, and
   hashtag rules (e.g., LinkedIn ≤3000 chars with 3–5 hashtags; X ≤280 chars with 1–2
   hashtags).
3. **Given** the notification of a publish is received, **When** the system accepts it,
   **Then** the notification sender receives an immediate acknowledgement and all
   content work happens in the background.
4. **Given** one platform fails to accept its post, **When** the system processes the
   batch, **Then** the other five platforms still receive their content and the failure
   is recorded separately.

---

### User Story 2 - Review, approve, or reject generated content before publishing (Priority: P2)

For platforms where the owner wants a human in the loop, generated content waits in a
"pending approval" state. The owner opens the dashboard, previews exactly what would be
posted to each platform, and approves or rejects each piece individually. Approved
content is published; rejected content is not.

**Why this priority**: Many owners will not trust fully automated posting to their
professional channels on day one. Approval mode makes the product safe to adopt and is
the natural complement to auto-publish. It depends on US1 producing content but adds the
control layer that drives real-world trust.

**Independent Test**: With a platform set to manual approval, publish a post, confirm
the generated content appears as "pending" in the dashboard with an accurate preview,
approve it, and verify it is published; separately reject another and verify it is not.

**Acceptance Scenarios**:

1. **Given** a platform is set to manual approval, **When** a post triggers content
   generation, **Then** that platform's content is saved as "pending approval" and is
   NOT published automatically.
2. **Given** pending content exists, **When** the owner opens the dashboard, **Then**
   they see a preview of the exact content (text, hashtags, link) that would be posted
   for each platform.
3. **Given** the owner reviews pending content, **When** they approve it, **Then** the
   system publishes it to that platform and updates its status to "published".
4. **Given** the owner reviews pending content, **When** they reject it, **Then** the
   content is marked "rejected" and is never published.
5. **Given** a platform's auto-publish toggle, **When** the owner switches it on or off,
   **Then** subsequent posts for that platform are published automatically or held for
   approval accordingly, independently of the other platforms.

---

### User Story 3 - Connect and manage social media accounts (Priority: P2)

The owner connects each social media account to the app through a secure sign-in flow,
sees at a glance which accounts are connected, and is alerted when an account's
authorization has expired and needs reconnection. The app keeps authorizations alive
automatically where possible and lets the owner disconnect an account at any time.

**Why this priority**: No content can be published to a platform that isn't connected,
so connection management is a hard prerequisite for the publishing in US1 and US2. It
is P2 rather than P1 only because content generation (US1) can be demonstrated before
live publishing is wired to every platform.

**Independent Test**: Connect one platform via its sign-in flow, confirm it shows as
"connected", simulate an expired authorization and confirm a "token expired" alert
appears, then disconnect it and confirm it shows as "disconnected".

**Acceptance Scenarios**:

1. **Given** a platform is not connected, **When** the owner completes that platform's
   sign-in/authorization flow, **Then** the account is securely linked and shown as
   "connected".
2. **Given** a connected account's authorization is nearing or past expiry, **When** the
   system can renew it automatically, **Then** it renews without owner involvement and
   stays "connected".
3. **Given** an account's authorization has expired and cannot be renewed automatically,
   **When** the owner views the dashboard, **Then** that account is shown as "token
   expired" with a prompt to reconnect.
4. **Given** a connected account, **When** the owner disconnects it, **Then** the stored
   authorization is removed and the account is shown as "disconnected".

---

### User Story 4 - Monitor status and recover failed publishes (Priority: P3)

The owner can see every WordPress post that triggered the automation and the publish
status of each platform's content (pending, approved, published, failed). When a publish
fails, the system retries automatically a limited number of times; if it still fails, the
owner can trigger a manual retry from the dashboard. Every failure is recorded with its
error details.

**Why this priority**: Visibility and recovery make the system trustworthy over time but
are not required to demonstrate the core publish-once-promote-everywhere value. They
build on US1–US3 by surfacing and repairing the outcomes those stories produce.

**Independent Test**: Force a platform publish to fail, confirm the dashboard shows it as
"failed" with an error reason after automatic retries are exhausted, click manual retry,
and confirm the system attempts the publish again and updates the status.

**Acceptance Scenarios**:

1. **Given** posts have been processed, **When** the owner opens the dashboard, **Then**
   they see each triggering post and the per-platform status (pending, approved,
   published, failed).
2. **Given** a publish attempt fails, **When** the system handles the failure, **Then**
   it automatically retries up to 3 times with increasing delays between attempts.
3. **Given** automatic retries are exhausted and the publish still failed, **When** the
   owner views the item, **Then** it is shown as "failed" with the recorded error reason
   and a manual retry control.
4. **Given** a failed publish, **When** the owner triggers a manual retry, **Then** the
   system attempts the publish again and updates the status to the new outcome.

---

### Edge Cases

- **Incomplete notification payload**: When the publish notification is missing required
  post data (e.g., excerpt, featured image, or full content), the system fetches the
  complete post data directly from WordPress before generating content. If the post still
  cannot be retrieved, the run is recorded as failed with a clear reason and no partial
  content is published.
- **Unverified or tampered notification**: A publish notification whose signature does
  not match the shared secret is rejected and not processed; the rejection is recorded.
- **Duplicate notifications**: If the same post-publish notification arrives more than
  once, the system does not generate or publish duplicate content for the same post.
- **Platform not connected at publish time**: If a platform is disconnected or its
  authorization has expired when a post is processed, that platform's content is recorded
  as needing attention (not published) without blocking the other platforms.
- **Content exceeds platform limit after generation**: If generated content would exceed
  a platform's limit, it is brought within the limit before being posted or held;
  oversized content is never sent to a platform.
- **Generation produces unusable output**: If content generation returns nothing usable
  for a platform, that platform's item is marked failed with a reason and the others
  proceed.
- **Authorization expires mid-batch**: If an account's authorization expires while a batch
  is being published, the system attempts renewal; if renewal fails, that platform's item
  is recorded for reconnection while others continue.
- **WordPress post updated/unpublished after trigger**: Re-publishing or updating is out
  of scope for this phase; only the publish event triggers automation.
- **YouTube community posting limitation**: The public YouTube Data API provides no endpoint
  to create community posts. For this phase, YouTube content is generated and held for the
  owner to publish manually (or attach as a video description); it is not auto-published as
  a community post. The 500-subscriber requirement applies only to the manual UI feature.

## Requirements _(mandatory)_

### Functional Requirements

#### Triggering & WordPress Integration

- **FR-001**: System MUST receive a notification when a post is published on the connected
  WordPress site.
- **FR-002**: System MUST verify each incoming publish notification using an HMAC-SHA256
  signature supplied in a request header, compared against the configured shared secret
  with a constant-time comparison, and MUST reject any notification that fails verification
  before any processing occurs.
- **FR-003**: System MUST acknowledge a valid notification immediately and perform all
  content generation and publishing work in the background, so the sender is never kept
  waiting.
- **FR-004**: System MUST extract the post title, content, excerpt, featured image
  reference, post URL, categories, and tags from the notification.
- **FR-005**: When the notification is missing any required post data, System MUST fetch
  the complete post data directly from WordPress (via the NovaMira integration) before
  generating content.
- **FR-006**: System MUST avoid generating or publishing duplicate content when the same
  publish event is received more than once.

#### Content Generation

- **FR-007**: System MUST generate distinct social media content for each of the six
  platforms: LinkedIn, Instagram, Facebook, YouTube, X/Twitter, and TikTok.
- **FR-008**: Generated content for each platform MUST be relevant to the specific
  WordPress post's topic and MUST NOT be a generic, interchangeable summary.
- **FR-009**: Every generated piece of content MUST include a direct link back to the
  original WordPress post.
- **FR-010**: Generated content MUST conform to each platform's rules:
  - LinkedIn: professional tone, ≤3000 characters, 3–5 relevant hashtags, includes the
    post link with a call to action.
  - Instagram: visual-first tone, ≤2200 characters, 10–15 hashtags, strong hook in the
    first line, post link included as a caption note (links are not clickable).
  - Facebook: conversational tone, kept under 500 characters for engagement (hard limit
    far higher), 2–3 hashtags, includes a clickable post link.
  - YouTube: community post or video description, ≤5000 characters, timestamps where
    relevant, includes the post link.
  - X/Twitter: punchy and direct, ≤280 characters, 1–2 hashtags, includes a shortened
    post link.
  - TikTok: trendy and engaging tone, ≤2200 characters, 3–5 hashtags, hook in the first
    line, post link included as a bio note.
- **FR-011**: System MUST guarantee that content sent to any platform is within that
  platform's character limit by hard-truncating over-limit content at a word boundary while
  always preserving the post link; regeneration is not used for limit enforcement.

#### Publishing & Approval

- **FR-012**: System MUST support, per platform independently, an auto-publish mode and a
  manual-approval mode, toggleable by the owner.
- **FR-013**: For platforms in auto-publish mode, System MUST publish generated content
  to the platform automatically once it is generated and validated.
- **FR-014**: For platforms in manual-approval mode, System MUST hold generated content in
  a "pending approval" state and MUST NOT publish it until the owner approves it.
- **FR-015**: Owner MUST be able to approve or reject pending content per platform;
  approved content MUST be published and rejected content MUST never be published.
- **FR-016**: System MUST continue processing and publishing for all other platforms even
  if one platform's generation or publish fails.

#### Account Connection

- **FR-017**: Owner MUST be able to connect each social media account through a secure
  authorization (OAuth 2.0) flow. Instagram publishing MUST use the Instagram Graph API via
  a connected Facebook/Instagram Business account (the Basic Display API cannot publish).
- **FR-018**: System MUST store account access credentials securely (encrypted at rest) in
  a single account-connections store keyed by a platform identifier, and MUST NOT expose
  them in the interface or in logs.
- **FR-019**: System MUST automatically renew account authorizations before or upon expiry
  where the platform allows it.
- **FR-020**: System MUST display each platform's connection status as one of: connected,
  token expired, or disconnected, and MUST alert the owner when reconnection is required.
- **FR-021**: Owner MUST be able to disconnect any connected account, after which its
  stored credentials are removed.

#### Dashboard & Visibility

- **FR-022**: System MUST provide an admin dashboard listing all incoming WordPress posts
  that triggered the automation. The dashboard MUST require the owner to authenticate (via a
  single GitHub sign-in restricted to the owner's account) before any data or control is
  accessible.
- **FR-023**: Dashboard MUST let the owner preview the generated content for each platform
  before it publishes.
- **FR-024**: Dashboard MUST show the publish status of each piece of content as one of:
  pending, approved, published, or failed.
- **FR-025**: Dashboard MUST let the owner toggle auto-publish mode on or off per platform
  independently.
- **FR-026**: Dashboard MUST let the owner trigger a manual retry of any failed publish.

#### Reliability & Logging

- **FR-027**: System MUST log every failed publish attempt with its error details.
- **FR-028**: System MUST automatically retry a failed publish up to 3 times using
  exponential backoff with jitter between attempts before marking it failed.
- **FR-029**: System MUST record an audit entry for every publish attempt, success, and
  failure, per platform per post.
- **FR-030**: A failure on any single platform MUST NOT prevent processing of the other
  platforms for the same post.

### Key Entities _(include if feature involves data)_

- **WordPress Post (Trigger)**: A published article that started an automation run. Key
  attributes: title, content, excerpt, featured image reference, post URL, categories,
  tags, received timestamp, source-completeness (whether data was backfilled).
- **Generated Content Item**: One piece of platform-specific content produced for a given
  post and platform, stored as one record per platform per post (normalized). Key
  attributes: target platform, generated text, hashtags, included post link, character
  count, and lifecycle status (pending, approved, rejected, published, failed).
- **Social Account Connection**: The owner's link to one platform, stored in a single
  account-connections store with a platform identifier column. Key attributes: platform,
  connection status (connected / token expired / disconnected), securely stored (encrypted)
  credentials, expiry information, auto-publish setting.
- **Publish Attempt / Audit Log**: A record of an attempt to publish a content item. Key
  attributes: associated content item and platform, attempt number, outcome
  (success/failure), error details, timestamp.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For 100% of verified publish notifications, the owner sees content generated
  for all six platforms.
- **SC-002**: 100% of generated content items include a working link back to the original
  WordPress post and fall within their platform's character limit.
- **SC-003**: The publish notification is acknowledged in under 2 seconds, with no content
  work delaying that acknowledgement.
- **SC-004**: When a single platform fails, the other five still complete in at least 99%
  of multi-platform runs (no whole-batch failures caused by one platform).
- **SC-005**: 100% of failed publishes are automatically retried up to 3 times before
  being surfaced as "failed", and every failure has recorded error details visible to the
  owner.
- **SC-006**: Notifications that fail signature verification are rejected 100% of the time
  and never produce published content.
- **SC-007**: The owner can go from seeing a pending item to having it published (or
  rejected) in under 1 minute using the dashboard.
- **SC-008**: When an account authorization expires, the owner is alerted on the dashboard
  and can reconnect; expired accounts never silently drop posts without being flagged.

## Assumptions

- **Single owner/admin**: The dashboard is used by a single site owner (the administrator);
  multi-user roles and permissions are out of scope for this phase.
- **Single WordPress site**: Exactly one WordPress site is connected (per stated non-goal).
- **Publish-event only**: Only the "post published" event triggers automation; post
  updates, deletions, and scheduled future publishing are out of scope.
- **Queue means "await approval"**: "Queue" refers to holding content for manual approval,
  not scheduling for a future time.
- **Platform API eligibility**: The owner holds accounts (and any required business/creator
  account types) that the six platforms require for programmatic posting; platforms that
  only allow link-in-bio/caption placement (Instagram, TikTok) are handled per FR-010.
  Instagram posting specifically requires a Facebook/Instagram Business account (Instagram
  Graph API). YouTube community posting is not available via the public API and is handled
  per the YouTube edge case above.
- **Dashboard authentication**: The dashboard is protected by a single sign-in provider
  (GitHub) limited to the owner's account; broader identity-provider support is out of scope.
- **Shared secret available**: A shared secret for signing webhook notifications is
  configured on both the WordPress site and this app.
- **NovaMira availability**: The NovaMira integration can reach the WordPress site to
  backfill missing post data when needed.
- **Immediate publishing**: Approved/auto content is published immediately, not scheduled.
- **No media generation**: Featured images come from the WordPress post; the system does
  not generate images and uses existing media references only.

## Review & Acceptance Checklist

### Content Quality

- [x] No implementation details that constrain design beyond stated requirements
- [x] Focused on user value and business needs
- [x] Written so a non-technical stakeholder can follow the intent
- [x] All mandatory sections completed

### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded (non-goals stated)
- [x] Dependencies and assumptions identified

### Clarifications Resolved (Session 2026-06-29)

- [x] Over-limit content handling defined (truncate at word boundary, preserve link — FR-011)
- [x] Generated-content storage model defined (one row per platform per post — Key Entities)
- [x] OAuth token storage model defined (single table, platform column, encrypted — FR-018)
- [x] Dashboard authentication defined (GitHub sign-in, owner-restricted — FR-022)
- [x] Webhook verification method defined (HMAC-SHA256 header, constant-time — FR-002)
- [x] Instagram publishing path defined (Instagram Graph API + Business account — FR-017)
- [x] YouTube community-post limitation captured (no public API endpoint — Edge Cases)
- [x] Retry strategy defined (exponential backoff with jitter, 3 retries — FR-028)

### Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No unresolved high-impact ambiguities remain
