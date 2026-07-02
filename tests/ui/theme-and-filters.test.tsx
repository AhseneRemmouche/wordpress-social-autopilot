import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  router: { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => "/dashboard",
  useSearchParams: () => nav.searchParams,
}));

import { DashboardToolbar } from "@/components/DashboardToolbar";
import { PostsFeed } from "@/components/PostsFeed";
import type { PostSummary } from "@/components/PostRow";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

beforeEach(() => {
  nav.searchParams = new URLSearchParams();
  nav.router.replace.mockClear();
  document.documentElement.className = "";
  document.cookie = "theme=; path=/; max-age=0";
});

describe("ThemeToggle", () => {
  it("flips the .dark class and persists the theme cookie", async () => {
    render(<ThemeToggle />);
    const toggle = screen.getByRole("switch", { name: "Toggle dark mode" });

    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await userEvent.click(toggle);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.cookie).toContain("theme=dark");

    await userEvent.click(toggle);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.cookie).toContain("theme=light");
  });
});

describe("DashboardToolbar (syncs to the URL)", () => {
  it("writes the status filter to the query", async () => {
    render(<DashboardToolbar />);
    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "PENDING");
    expect(nav.router.replace).toHaveBeenCalledWith("/dashboard?status=PENDING", { scroll: false });
  });

  it("writes the search term to the query", () => {
    render(<DashboardToolbar />);
    fireEvent.change(screen.getByLabelText("Search posts by title"), {
      target: { value: "widgets" },
    });
    expect(nav.router.replace).toHaveBeenLastCalledWith("/dashboard?q=widgets", { scroll: false });
  });
});

describe("PostsFeed (filters the rendered list from the URL)", () => {
  const posts: PostSummary[] = [
    {
      id: "1",
      title: "Alpha",
      url: "https://a.example.com",
      receivedAt: "2026-06-01T00:00:00.000Z",
      platforms: [{ platform: "X", contentId: "x1", status: "FAILED" }],
    },
    {
      id: "2",
      title: "Beta",
      url: "https://b.example.com",
      receivedAt: "2026-06-01T00:00:00.000Z",
      platforms: [{ platform: "X", contentId: "x2", status: "PUBLISHED" }],
    },
  ];

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  });

  it("narrows to posts matching the status filter", () => {
    nav.searchParams = new URLSearchParams("status=FAILED");
    render(<PostsFeed initialPosts={posts} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });

  it("narrows to posts matching the search term", () => {
    nav.searchParams = new URLSearchParams("q=beta");
    render(<PostsFeed initialPosts={posts} />);
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });
});
