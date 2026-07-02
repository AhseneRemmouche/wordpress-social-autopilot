import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import type { ReactElement, ReactNode } from "react";

import { AppShell } from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { authOptions } from "@/lib/auth";
import { DEV_USER, devAuthBypassEnabled } from "@/lib/dev";

/**
 * Dashboard route-group layout (FR-022, plan §7). Server-side guard: every page
 * under `(dashboard)` requires an authenticated owner session — unauthenticated
 * requests are redirected to `/signin` before any content renders. The responsive
 * shell (sidebar / top bar / mobile drawer) and the toast provider wrap all pages.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactElement> {
  const session = await getServerSession(authOptions);
  if (!session && !devAuthBypassEnabled()) {
    redirect("/signin");
  }

  const user = session?.user ?? DEV_USER;

  return (
    <ToastProvider>
      <AppShell
        user={{ name: user.name, email: user.email, image: user.image }}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
