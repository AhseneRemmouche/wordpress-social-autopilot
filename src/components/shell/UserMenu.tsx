"use client";

import { signOut } from "next-auth/react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";

import { ThemeToggle } from "@/components/ui/ThemeToggle";

export interface UserMenuUser {
  name?: string | null;
  email?: string | null;
}

/** Visible (not display:none) focusable buttons inside the menu. */
function visibleButtons(menu: HTMLElement | null): HTMLElement[] {
  return Array.from(menu?.querySelectorAll<HTMLElement>("button") ?? []).filter(
    (el) => el.offsetParent !== null,
  );
}

/**
 * Account menu (UI-15): avatar/initials trigger + dropdown with the theme toggle
 * (mobile) and Sign out (NextAuth). Accessible — roving focus with arrow keys,
 * Escape + focus restore, Tab and outside-click to close.
 */
export function UserMenu({ user }: { user: UserMenuUser }): ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const label = user.name ?? user.email ?? "Account";
  const initials = label.trim().slice(0, 1).toUpperCase();

  // Close on outside pointer-down.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Move focus to the first item when the menu opens.
  useEffect(() => {
    if (open) visibleButtons(menuRef.current)[0]?.focus();
  }, [open]);

  function onMenuKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === "Tab") {
      setOpen(false); // let focus move naturally
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") {
      return;
    }
    const items = visibleButtons(menuRef.current);
    if (items.length === 0) return;
    e.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "ArrowDown"
        ? (current + 1) % items.length
        : e.key === "ArrowUp"
          ? (current - 1 + items.length) % items.length
          : e.key === "Home"
            ? 0
            : items.length - 1;
    items[next]?.focus();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${label}`}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-xs font-medium text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {initials}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Account menu"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-text">{user.name ?? "Signed in"}</p>
            {user.email && <p className="truncate text-xs text-muted">{user.email}</p>}
          </div>

          {/* Theme control — mobile only (the top bar has the toggle on >= sm). */}
          <div className="flex items-center justify-between px-3 py-2 sm:hidden">
            <span className="text-sm text-text">Theme</span>
            <ThemeToggle />
          </div>

          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut({ callbackUrl: "/signin" })}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 text-muted"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
