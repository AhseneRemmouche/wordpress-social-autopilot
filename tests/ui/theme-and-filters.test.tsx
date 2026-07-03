import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("PostsFeed summary cards (count posts, not platform items)", () => {
  // Alpha has two PENDING items; Beta has one PENDING and one MANUAL_REQUIRED.
  // Posts per bucket: pending 2, manual 1. Items per bucket: pending 3, manual 1.
  const posts: PostSummary[] = [
    {
      id: "1",
      title: "Alpha",
      url: "https://a.example.com",
      receivedAt: "2026-06-01T00:00:00.000Z",
      platforms: [
        { platform: "X", contentId: "x1", status: "PENDING" },
        { platform: "LINKEDIN", contentId: "l1", status: "PENDING" },
      ],
    },
    {
      id: "2",
      title: "Beta",
      url: "https://b.example.com",
      receivedAt: "2026-06-01T00:00:00.000Z",
      platforms: [
        { platform: "X", contentId: "x2", status: "PENDING" },
        { platform: "TIKTOK", contentId: "t2", status: "MANUAL_REQUIRED" },
      ],
    },
  ];

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  });

  it("shows how many posts need attention, matching the card's filtered list", () => {
    render(<PostsFeed initialPosts={posts} />);

    const pending = screen.getByRole("link", { name: /pending review/i });
    expect(within(pending).getByText("2")).toBeInTheDocument();
    expect(within(pending).getByText("3 content items")).toBeInTheDocument();

    const manual = screen.getByRole("link", { name: /manual required/i });
    expect(within(manual).getByText("1")).toBeInTheDocument();
    expect(within(manual).getByText("1 content item")).toBeInTheDocument();
  });
});

describe("PostsFeed freshness indicator", () => {
  const posts: PostSummary[] = [
    {
      id: "1",
      title: "Alpha",
      url: "https://a.example.com",
      receivedAt: "2026-06-01T00:00:00.000Z",
      platforms: [{ platform: "X", contentId: "x1", status: "PENDING" }],
    },
  ];

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a paused indicator instead of 'Live' when the poll fails", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<PostsFeed initialPosts={posts} />);

    expect(screen.getByText("Live")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(screen.getByText(/refresh paused/i)).toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });

  it("recovers to the live indicator once a poll succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue({ ok: true, json: async () => posts });
    vi.stubGlobal("fetch", fetchMock);
    render(<PostsFeed initialPosts={posts} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByText(/refresh paused/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByText(/updated just now/i)).toBeInTheDocument();
    expect(screen.queryByText(/refresh paused/i)).not.toBeInTheDocument();
  });
});
