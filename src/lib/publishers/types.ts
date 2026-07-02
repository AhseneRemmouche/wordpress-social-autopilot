import type { GeneratedContent, Platform, PlatformAccount } from "@prisma/client";

/**
 * Publisher contract (plan §5, Constitution Principle III). Each platform has its
 * own isolated module implementing this interface; no platform-specific logic
 * leaks across boundaries, and each is independently testable with mocked API
 * responses (no live network).
 */

export interface PublisherCapabilities {
  /** Whether this platform can be published to automatically by the worker. */
  autoPublish: boolean;
  /** Whether a media URL (the post's featured image) is required to publish. */
  requiresMedia: boolean;
}

/**
 * Result of a publish attempt.
 * - On failure, `retryable` tells the queue whether to retry with backoff.
 * - `error` is a short, human-readable message that MUST be secret-free
 *   (no tokens, signatures, or credentials).
 */
export type PublishResult =
  | { ok: true; externalId?: string }
  | { ok: false; retryable: boolean; error: string };

export interface Publisher {
  platform: Platform;
  capabilities: PublisherCapabilities;
  publish(
    content: GeneratedContent,
    account: PlatformAccount,
  ): Promise<PublishResult>;
}
