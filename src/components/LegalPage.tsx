import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

/**
 * Shared shell for the public legal pages (/terms, /privacy). Kept outside the
 * (dashboard) route group so it renders without the owner-session guard — these
 * URLs must be reachable by third parties (e.g. platform app reviewers).
 */
export function LegalPage({
  title,
  updated,
  children,
}: Readonly<{ title: string; updated: string; children: ReactNode }>): ReactElement {
  return (
    <main className="min-h-dvh bg-bg text-text">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link href="/" className="text-sm text-muted hover:text-text">
          &larr; WordPress Social Autopilot
        </Link>
        <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-text [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text [&_a]:text-primary [&_a]:underline">
          {children}
        </div>
      </div>
    </main>
  );
}
