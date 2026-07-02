<!--
SYNC IMPACT REPORT
==================
Version change: (template / unversioned) → 1.0.0
Bump rationale: Initial ratification of the project constitution. MAJOR baseline
  established from the eight focus areas supplied at adoption.

Principles defined (new):
  I.   Code Quality
  II.  Security Standards
  III. API Integration Principles
  IV.  AI Content Generation
  V.   Database Principles
  VI.  User Experience (Dashboard)
  VII. Testing Standards
  VIII.Framework Version Policy

Added sections:
  - Core Principles (I–VIII)
  - Development Workflow & Quality Gates
  - Governance

Removed sections: none (initial adoption).

Templates requiring updates:
  ✅ .specify/templates/plan-template.md — "Constitution Check" gate is generic
     (dynamically references this file); no change required.
  ✅ .specify/templates/spec-template.md — no constitution-specific tokens; no change required.
  ✅ .specify/templates/tasks-template.md — task categories accommodate testing/security/
     observability tasks already; no change required.
  ✅ .claude/skills/speckit-*/SKILL.md — generic guidance; no outdated references.

Follow-up TODOs: none. RATIFICATION_DATE set to initial adoption date 2026-06-29.
-->

# WordPress Social Autopilot Constitution

## Core Principles

### I. Code Quality

TypeScript strict mode MUST be enabled in every package and MUST never be relaxed
per-file or per-line. Every value MUST be explicitly typed; the `any` type is
forbidden — use `unknown` plus a Zod-validated narrowing when a type is genuinely
unknown. All data crossing a runtime boundary (HTTP requests, webhook payloads,
external API responses, environment variables, database reads of untyped JSON) MUST
be validated with a Zod schema at the point of entry. Functions MUST be small,
single-purpose, and independently testable; a function that does more than one thing
MUST be split.

**Rationale**: Static guarantees plus runtime validation at the edges eliminate the
two largest classes of production defects — type drift and malformed external data —
before they reach business logic.

### II. Security Standards

All webhook payloads MUST be signature-verified before any processing occurs; an
unverified payload MUST be rejected and never partially handled. OAuth tokens and
other third-party credentials MUST be encrypted at rest in the database — plaintext
secret storage is forbidden. Environment variables MUST be validated at startup with
a Zod schema, and the process MUST refuse to boot if validation fails. Secrets MUST
NOT appear in source code, configuration committed to the repository, or logs;
logging of token values, signatures, or credential material is forbidden.

**Rationale**: This system holds publishing credentials for external accounts. A
single leaked token or spoofed webhook can compromise a user's social presence, so
verification and encryption are non-negotiable gates.

### III. API Integration Principles

Each social media platform MUST have its own isolated publisher module with a shared,
explicit interface; platform-specific logic MUST NOT leak across module boundaries.
Every external API call MUST handle rate limits, token expiry (including refresh), and
retry logic with backoff. Failed publishes MUST be logged with full error context
(platform, post reference, request/response metadata excluding secrets) and retried
automatically according to a defined policy. Publisher modules MUST be independently
testable with mocked API responses and MUST NOT require live network access to test.

**Rationale**: Isolation keeps one platform's API changes or outages from cascading,
and disciplined retry/rate-limit handling is what makes autonomous publishing reliable.

### IV. AI Content Generation

Claude AI prompts MUST be version-controlled as named constants, never assembled as
inline ad-hoc strings at call sites. Every Claude AI response MUST be validated with a
Zod schema before any downstream use. Generated content MUST respect each platform's
character limits, tone, and formatting rules before it is queued for publishing. Every
generated piece of content MUST include a link back to the originating WordPress post.

**Rationale**: Treating prompts as reviewable artifacts and validating model output
makes AI behavior auditable and safe to automate, while the backlink guarantees every
syndicated post drives traffic to the source.

### V. Database Principles

The Prisma schema MUST be the single source of truth for all data models; no model may
be defined or mutated outside it. Every database operation MUST be wrapped in error
handling — unhandled query rejections are forbidden. An audit log entry MUST be written
for every publish attempt, success, and failure, capturing enough context to
reconstruct what happened without exposing secrets.

**Rationale**: A single schema source prevents model drift, and a complete audit trail
is required to debug, prove, and recover from publishing outcomes.

### VI. User Experience (Dashboard)

The dashboard MUST show real-time publish status per platform. Content MUST be
previewable in its final, platform-specific form before publishing. Manual approval
mode and auto-publish mode MUST be independently toggleable per platform.

**Rationale**: Operators need visibility and control proportional to the risk of
automated publishing; per-platform toggles let users adopt automation incrementally
and with confidence.

### VII. Testing Standards

The webhook receiver MUST have integration tests covering signature verification and
payload handling. Every Zod schema MUST have unit tests for both valid and invalid
inputs. Publisher modules MUST have unit tests with mocked API calls covering success,
rate-limit, token-expiry, and failure paths. Claude AI content generation MUST have
tests with mocked API responses, including malformed-response handling.

**Rationale**: The riskiest seams of this system — the webhook boundary, validation
schemas, external publishers, and AI output — are exactly where tests are mandated, so
regressions in those seams cannot ship silently.

### VIII. Framework Version Policy

Before any implementation code is written for a framework or library, the official
documentation MUST be consulted to confirm the latest stable version. The confirmed
version MUST be recorded in the feature's `research.md` before the dependency is added
to the project. Adding a dependency without a documented, confirmed version is
forbidden.

**Rationale**: Pinning to a verified current version recorded in research prevents
silent drift onto deprecated or pre-release packages and makes every dependency choice
traceable to a documented decision.

## Development Workflow & Quality Gates

- Every feature plan produced by `/speckit-plan` MUST pass the Constitution Check gate
  against the principles above before Phase 0 research begins, and MUST be re-checked
  after Phase 1 design.
- Code review MUST verify compliance with all applicable principles; a reviewer MUST
  block merge on any violation that is not recorded and justified in the plan's
  Complexity Tracking section.
- The dependency-version confirmation required by Principle VIII MUST be present in
  `research.md` before implementation tasks that introduce the dependency are started.
- Tests mandated by Principle VII MUST exist and pass before the corresponding feature
  is considered complete.

## Governance

This constitution supersedes all other development practices where they conflict. All
pull requests and reviews MUST verify compliance with the principles herein. Any
complexity or deviation from a principle MUST be explicitly justified in the relevant
plan's Complexity Tracking table; unjustified deviations MUST be rejected.

Amendments MUST be proposed as a change to this file, documented with rationale, and
versioned according to semantic versioning:

- **MAJOR**: Backward-incompatible governance changes — removing or redefining a
  principle in a way that invalidates existing compliant work.
- **MINOR**: Adding a new principle or section, or materially expanding guidance.
- **PATCH**: Clarifications, wording, and non-semantic refinements.

On every amendment, the version, ratification date, and last-amended date below MUST be
updated, and dependent templates and guidance files MUST be re-validated for
consistency.

**Version**: 1.0.0 | **Ratified**: 2026-06-29 | **Last Amended**: 2026-06-29
