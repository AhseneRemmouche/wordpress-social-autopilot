"use client";

import type { ContentStatus, Platform } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { RetryButton } from "@/components/RetryButton";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { cx } from "@/components/ui/cx";
import { getCharLimit } from "@/lib/limits";

/** A per-platform generated-content preview (matches GET /api/posts/[postId]). */
export interface ContentPreview {
  contentId: string;
  platform: Platform;
  status: ContentStatus;
  body: string;
  hashtags: string[];
  link: string;
  charCount: number;
}

const PLATFORM_LABEL: Record<Platform, string> = {
  LINKEDIN: "LinkedIn",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  YOUTUBE: "YouTube",
  X: "X",
  TIKTOK: "TikTok",
};

const MEDIA_REQUIRED = new Set<Platform>(["INSTAGRAM", "TIKTOK"]);

type BusyAction = "approve" | "reject";

/** Character-count meter: neutral < 90%, warning >= 90%, danger when over. */
function CharMeter({ count, limit }: { count: number; limit: number }): ReactElement {
  const ratio = count / limit;
  const over = count > limit;
  const near = !over && ratio >= 0.9;
  const pct = Math.min(100, Math.round(ratio * 100));
  const bar = over ? "bg-danger" : near ? "bg-warning" : "bg-success";
  const text = over ? "text-danger" : near ? "text-warning" : "text-muted";

  return (
    <div>
      <div className={cx("text-xs tabular-nums", text)}>
        {count} / {limit} characters
      </div>
      <div
        className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={count}
      >
        <div className={cx("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * A single platform's preview card (FR-023): body + styled hashtags + backlink,
 * a character-count meter vs the platform limit, a media hint, and the status
 * badge. PENDING → Approve/Reject with optimistic status + toast (FR-015);
 * FAILED → Retry (FR-026).
 */
export function PlatformPreviewCard({ content }: { content: ContentPreview }): ReactElement {
  const router = useRouter();
  const toast = useToast();
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [optimistic, setOptimistic] = useState<ContentStatus | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  const label = PLATFORM_LABEL[content.platform];
  const status = optimistic ?? content.status;
  const busy = busyAction !== null;

  async function act(action: BusyAction): Promise<void> {
    const target: ContentStatus = action === "approve" ? "APPROVED" : "REJECTED";
    setBusyAction(action);
    setOptimistic(target);
    try {
      const res = await fetch(`/api/content/${content.contentId}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      toast.success(
        action === "approve" ? "Approved — queued to publish." : "Rejected.",
        label,
      );
      router.refresh();
    } catch {
      setOptimistic(null); // revert optimistic status
      toast.error(`Couldn't ${action} ${label}. Please try again.`);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReject(): Promise<void> {
    await act("reject");
    setConfirmReject(false);
  }

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
        <StatusBadge status={status} />
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-text">{content.body}</p>

      {content.hashtags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {content.hashtags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <a
        href={content.link}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block truncate text-xs text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
      >
        {content.link}
      </a>

      <div className="mt-3">
        <CharMeter count={content.charCount} limit={getCharLimit(content.platform)} />
      </div>

      {MEDIA_REQUIRED.has(content.platform) && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="1.5" />
            <path d="m21 15-4.5-4.5L6 21" />
          </svg>
          Requires the post&apos;s featured image to publish.
        </p>
      )}

      {status === "PENDING" && (
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={() => void act("approve")} loading={busyAction === "approve"} disabled={busy}>
            Approve
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setConfirmReject(true)}
            disabled={busy}
          >
            Reject
          </Button>
        </div>
      )}

      <RetryButton contentId={content.contentId} status={status} />

      <ConfirmDialog
        open={confirmReject}
        onOpenChange={setConfirmReject}
        title="Reject this content?"
        description={`The ${label} post will be marked rejected and won't publish.`}
        confirmLabel="Reject"
        variant="danger"
        loading={busyAction === "reject"}
        onConfirm={() => void handleReject()}
      />
    </Card>
  );
}
