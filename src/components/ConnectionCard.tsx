"use client";

import type { AccountStatus, Platform } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { AutoPublishToggle } from "@/components/AutoPublishToggle";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastProvider";
import { cx } from "@/components/ui/cx";
import { platformSlug } from "@/lib/oauth/platform";

/** A platform's connection state as returned by GET /api/connections. */
export interface ConnectionView {
  platform: Platform;
  status: AccountStatus;
  expiresAt: string | null;
  autoPublish: boolean;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  LINKEDIN: "LinkedIn",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  X: "X",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
};

const PLATFORM_TILE: Record<Platform, string> = {
  LINKEDIN: "bg-linkedin/15 text-linkedin",
  INSTAGRAM: "bg-instagram/15 text-instagram",
  FACEBOOK: "bg-facebook/15 text-facebook",
  YOUTUBE: "bg-youtube/15 text-youtube",
  X: "bg-x/15 text-x",
  TIKTOK: "bg-tiktok/15 text-tiktok",
};

const PLATFORM_MONO: Record<Platform, string> = {
  LINKEDIN: "in",
  INSTAGRAM: "IG",
  FACEBOOK: "f",
  YOUTUBE: "YT",
  X: "X",
  TIKTOK: "TT",
};

const CAPABILITY_HINT: Partial<Record<Platform, string>> = {
  YOUTUBE: "Manual only — no publishing API",
  TIKTOK: "Publishes as a private draft until your app is audited",
  INSTAGRAM: "Auto-publish requires the post's featured image",
};

function expiryLabel(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "Token expired";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires in 1 day";
  return `Expires in ${days} days`;
}

/**
 * One platform's connection card (FR-020/FR-021/FR-025): branded tile + label,
 * status pill, expiry + capability hints, the auto-publish switch, and
 * Connect/Reconnect (OAuth start) / Disconnect (confirm + toast) actions.
 */
export function ConnectionCard({ connection }: { connection: ConnectionView }): ReactElement {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { platform, status } = connection;
  const label = PLATFORM_LABELS[platform];
  const slug = platformSlug(platform);
  const canConnect = status !== "CONNECTED";
  const canDisconnect = status !== "DISCONNECTED";

  const meta: string[] = [];
  if (connection.expiresAt) meta.push(expiryLabel(connection.expiresAt));
  const hint = CAPABILITY_HINT[platform];
  if (hint) meta.push(hint);

  async function disconnect(): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch(`/api/connections?platform=${slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`${label} disconnected.`);
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error(`Couldn't disconnect ${label}. Please try again.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span
          className={cx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
            PLATFORM_TILE[platform],
          )}
          aria-hidden="true"
        >
          {PLATFORM_MONO[platform]}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text">{label}</span>
            <ConnectionStatus status={status} />
          </div>
          {meta.length > 0 && (
            <p className="mt-0.5 text-xs text-muted" suppressHydrationWarning>
              {meta.join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {platform !== "YOUTUBE" && (
          <AutoPublishToggle platform={platform} autoPublish={connection.autoPublish} />
        )}

        {canConnect && (
          <a
            href={`/api/oauth/${slug}/start`}
            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            {status === "TOKEN_EXPIRED" ? "Reconnect" : "Connect"}
          </a>
        )}
        {canDisconnect && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirmOpen(true)}>
            Disconnect
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Disconnect ${label}?`}
        description="Stored tokens are purged. You'll need to reconnect to publish to this platform again."
        confirmLabel="Disconnect"
        variant="danger"
        loading={busy}
        onConfirm={() => void disconnect()}
      />
    </Card>
  );
}
