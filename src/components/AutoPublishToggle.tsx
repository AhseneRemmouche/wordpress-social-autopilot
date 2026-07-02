"use client";

import type { Platform } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { Switch } from "@/components/ui/Switch";

/**
 * Per-platform auto-publish switch (FR-025). Optimistically flips, PATCHes the
 * settings route, and reverts on failure. Independent per platform.
 */
export function AutoPublishToggle({
  platform,
  autoPublish,
}: {
  platform: Platform;
  autoPublish: boolean;
}): ReactElement {
  const router = useRouter();
  const [enabled, setEnabled] = useState(autoPublish);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean): Promise<void> {
    setBusy(true);
    setError(null);
    setEnabled(next); // optimistic
    try {
      const res = await fetch("/api/settings/auto-publish", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform, autoPublish: next }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      router.refresh();
    } catch (e) {
      setEnabled(!next); // revert
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={enabled}
        onCheckedChange={(next) => void toggle(next)}
        disabled={busy}
        label="Auto-publish"
      />
      <span className="text-xs text-muted">Auto-publish</span>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
