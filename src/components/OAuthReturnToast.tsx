"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactElement } from "react";

import { useToast } from "@/components/ui/ToastProvider";

const PLATFORM_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
  tiktok: "TikTok",
  youtube: "YouTube",
};

function errorMessage(code: string): string {
  switch (code) {
    case "connection_failed":
      return "Connection failed. Please try again.";
    case "missing_code":
      return "The connection was cancelled or incomplete.";
    case "unknown_platform":
      return "Unknown platform.";
    default:
      return `Connection failed (${code}).`;
  }
}

/**
 * Handles the OAuth callback redirect to /connections?connected=<slug> or
 * ?error=<code> (UI-27): toasts the outcome once, then strips the query from the
 * URL without a reload. Renders nothing.
 */
export function OAuthReturnToast(): ReactElement | null {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const handled = useRef(false);

  const connected = params.get("connected");
  const error = params.get("error");

  useEffect(() => {
    if (handled.current || (!connected && !error)) return;
    handled.current = true;
    if (connected) {
      toast.success(`${PLATFORM_LABEL[connected] ?? connected} connected.`);
    } else if (error) {
      toast.error(errorMessage(error));
    }
    router.replace("/connections", { scroll: false });
  }, [connected, error, router, toast]);

  return null;
}
