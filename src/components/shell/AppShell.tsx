"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import { Logo } from "@/components/shell/Logo";
import { UserMenu } from "@/components/shell/UserMenu";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cx } from "@/components/ui/cx";

export interface AppShellUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactElement;
}

function GridIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function PlugIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-5M9 8V2M15 8V2M6 8h12v3a6 6 0 0 1-12 0V8Z" />
    </svg>
  );
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <GridIcon /> },
  { href: "/connections", label: "Connections", icon: <PlugIcon /> },
];

function NavList({
  isActive,
  onNavigate,
}: {
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
}): ReactElement {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={cx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            isActive(item.href)
              ? "bg-surface-muted text-text"
              : "text-muted hover:bg-surface-muted hover:text-text",
          )}
        >
          <span className="shrink-0">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Responsive dashboard shell (UI-13): a sidebar (≥ md) with active-state nav, a
 * sticky top bar (mobile brand + page-title slot + ThemeToggle + user), and a
 * collapsible mobile drawer (< md). Token-driven and dark-aware.
 */
export function AppShell({
  user,
  children,
}: {
  user: AppShellUser;
  children: ReactNode;
}): ReactElement {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function isActive(href: string): boolean {
    return pathname === href || (href === "/dashboard" && pathname.startsWith("/posts"));
  }

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function closeDrawer(): void {
    setDrawerOpen(false);
    triggerRef.current?.focus(); // restore focus to the opener
  }

  // Escape closes the drawer (listener → setState is fine; not a synchronous effect body).
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent): void {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Move focus into the drawer when it opens.
  useEffect(() => {
    if (drawerOpen) panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();
  }, [drawerOpen]);

  // Trap Tab within the open drawer panel.
  function trapTab(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== "Tab") return;
    const focusables = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>("a[href], button") ?? [],
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const activeEl = document.activeElement;
    if (e.shiftKey && activeEl === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && activeEl === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className="flex min-h-dvh bg-bg text-text">
      {/* Sidebar (>= md) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <div className="flex h-14 items-center border-b border-border px-5">
          <span className="flex items-center gap-2 text-sm font-semibold text-text">
            <Logo size={20} />
            Social Autopilot
          </span>
        </div>
        <div className="flex-1 p-3">
          <NavList isActive={isActive} />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <span className="flex items-center gap-2 text-sm font-semibold text-text md:hidden">
            <Logo size={20} />
            Social Autopilot
          </span>
          {/* Page-title slot / spacer */}
          <div className="flex-1" />
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <UserMenu user={user} />
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>

      {/* Mobile drawer (< md) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} aria-hidden="true" />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            onKeyDown={trapTab}
            className="absolute left-0 top-0 flex h-dvh w-72 max-w-[80vw] flex-col border-r border-border bg-surface"
          >
            <div className="flex h-14 items-center justify-between border-b border-border px-5">
              <span className="flex items-center gap-2 text-sm font-semibold text-text">
            <Logo size={20} />
            Social Autopilot
          </span>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close navigation"
                className="rounded-lg p-1 text-muted transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="p-3">
              <NavList isActive={isActive} onNavigate={closeDrawer} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
