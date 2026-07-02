"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, type ReactElement } from "react";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "PUBLISHED", label: "Published" },
  { value: "FAILED", label: "Failed" },
  { value: "MANUAL_REQUIRED", label: "Manual" },
];

const PLATFORM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All platforms" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "X", label: "X" },
  { value: "TIKTOK", label: "TikTok" },
];

/**
 * Dashboard filter toolbar (UI-17). Status/platform/title filters, synced to the
 * URL query (`?status=&platform=&q=`) so they survive refresh and drive the feed.
 */
export function DashboardToolbar(): ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const status = params.get("status") ?? "";
  const platform = params.get("platform") ?? "";
  const q = params.get("q") ?? "";

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        type="search"
        placeholder="Search posts…"
        aria-label="Search posts by title"
        value={q}
        onChange={(e) => setParam("q", e.target.value)}
        className="sm:max-w-xs"
      />
      <Select
        aria-label="Filter by status"
        value={status}
        onChange={(e) => setParam("status", e.target.value)}
        className="sm:w-44"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Filter by platform"
        value={platform}
        onChange={(e) => setParam("platform", e.target.value)}
        className="sm:w-44"
      >
        {PLATFORM_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
