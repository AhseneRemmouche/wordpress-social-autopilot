import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactElement, ReactNode } from "react";
import "./globals.css";

// Clean UI sans, self-hosted by next/font and exposed as the --font-inter var,
// which globals.css maps onto --font-sans (the app-wide default font).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "WordPress Social Autopilot",
  description: "Automatically turn a published WordPress post into platform-tailored social posts.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactElement> {
  // Read the theme cookie server-side so the SSR HTML already carries `.dark`
  // (no flash of the wrong theme). Defaults to light when unset.
  const isDark = (await cookies()).get("theme")?.value === "dark";

  return (
    <html lang="en" className={`${inter.variable}${isDark ? " dark" : ""}`}>
      <body>{children}</body>
    </html>
  );
}
