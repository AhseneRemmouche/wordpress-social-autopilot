import type { Publisher, PublishResult } from "@/lib/publishers/types";

/**
 * YouTube publisher — manual-only (research.md, spec YouTube edge case).
 *
 * The public YouTube Data API v3 exposes NO endpoint to create community posts
 * (and community posts require ≥500 subscribers regardless). There is therefore
 * nothing to call: `publish()` never hits the network and always returns a
 * non-retryable result that the worker maps to MANUAL_REQUIRED. Content is
 * already routed to MANUAL_REQUIRED at generation time; this is the safety net.
 */

function publish(): Promise<PublishResult> {
  return Promise.resolve({
    ok: false,
    retryable: false,
    error: "YouTube community posts have no public write API; publish manually",
  });
}

export const youtubePublisher: Publisher = {
  platform: "YOUTUBE",
  capabilities: { autoPublish: false, requiresMedia: false },
  publish,
};
