"use client";

import { useEffect, useState, type ReactElement } from "react";

type Theme = "light" | "dark";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Apply a theme to the document and persist it in the `theme` cookie. */
function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.cookie = `theme=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

/** Resolve the effective theme: cookie (via the SSR class) wins; else the OS preference. */
function resolveTheme(): Theme {
  if (typeof document === "undefined") return "light"; // SSR default
  const hasCookie = document.cookie.split("; ").some((c) => c.startsWith("theme="));
  if (hasCookie) {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Light⇄dark toggle (UI-04). The visible icon is driven purely by the `.dark`
 * class (already correct in the SSR HTML from the cookie), so there is no flash.
 * The initial `aria-checked` comes from a lazy initializer that reads the DOM on
 * the client; a one-shot effect persists/adopts the OS preference on first visit.
 */
export function ThemeToggle(): ReactElement {
  // Lazy initializer runs on the client at hydration → correct aria-checked.
  const [isDark, setIsDark] = useState<boolean>(() => resolveTheme() === "dark");

  useEffect(() => {
    // Ensure the DOM + cookie match the resolved theme (first visit adopts +
    // persists the OS preference). Pure side-effect — no setState here.
    applyTheme(resolveTheme());
  }, []);

  function toggle(): void {
    const next: Theme = isDark ? "light" : "dark";
    applyTheme(next);
    setIsDark(next === "dark");
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      onClick={toggle}
      suppressHydrationWarning
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {/* Sun — shown in light mode */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5 dark:hidden"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      {/* Moon — shown in dark mode */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="hidden h-5 w-5 dark:block"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </svg>
    </button>
  );
}
