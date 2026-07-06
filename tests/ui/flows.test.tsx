import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routerMock = { refresh: vi.fn(), replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { AutoPublishToggle } from "@/components/AutoPublishToggle";
import { CheckNewPostsButton } from "@/components/CheckNewPostsButton";
import { ConnectionCard } from "@/components/ConnectionCard";
import { DeletePostButton } from "@/components/DeletePostButton";
import { PlatformPreviewCard, type ContentPreview } from "@/components/PlatformPreviewCard";
import { RetryButton } from "@/components/RetryButton";
import { ToastProvider } from "@/components/ui/ToastProvider";

function renderWithToast(ui: ReactElement): void {
  render(<ToastProvider>{ui}</ToastProvider>);
}

function okFetch(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({ ok: true, status: 200 });
}
function errFetch(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({ ok: false, status: 500 });
}

const pending: ContentPreview = {
  contentId: "c1",
  platform: "LINKEDIN",
  status: "PENDING",
  body: "Hello world",
  hashtags: ["#a"],
  link: "https://blog.example.com/p",
  charCount: 11,
};

beforeEach(() => {
  routerMock.refresh.mockClear();
  routerMock.replace.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PlatformPreviewCard", () => {
  it("approve → POST, toast, optimistic APPROVED", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderWithToast(<PlatformPreviewCard content={pending} />);

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/content/c1/approve", { method: "POST" });
    expect(await screen.findByText(/queued to publish/i)).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument(); // optimistic badge
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("reject → confirm → POST, toast, optimistic REJECTED", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderWithToast(<PlatformPreviewCard content={pending} />);

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/content/c1/reject", { method: "POST" });
    expect(await screen.findByText("Rejected.")).toBeInTheDocument(); // toast
    expect(screen.getByText("Rejected")).toBeInTheDocument(); // badge
  });
});

describe("RetryButton", () => {
  it("retry → POST, toast, optimistically hides", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderWithToast(<RetryButton contentId="c1" status="FAILED" />);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/content/c1/retry", { method: "POST" });
    expect(await screen.findByText(/Retry queued/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});

describe("AutoPublishToggle", () => {
  it("PATCHes and flips on success", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderWithToast(<AutoPublishToggle platform="LINKEDIN" autoPublish={false} />);

    const sw = screen.getByRole("switch", { name: "Auto-publish" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);

    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings/auto-publish",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("reverts on error", async () => {
    vi.stubGlobal("fetch", errFetch());
    renderWithToast(<AutoPublishToggle platform="LINKEDIN" autoPublish={false} />);

    const sw = screen.getByRole("switch", { name: "Auto-publish" });
    await userEvent.click(sw);

    await waitFor(() => expect(sw).toHaveAttribute("aria-checked", "false"));
    expect(screen.getByText(/Failed/i)).toBeInTheDocument();
  });
});

describe("CheckNewPostsButton", () => {
  function jsonFetch(body: {
    imported: number;
    generated: number;
    pending: number;
  }): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    });
  }

  it("generated → POST, success toast, refresh", async () => {
    const fetchMock = jsonFetch({ imported: 1, generated: 1, pending: 0 });
    vi.stubGlobal("fetch", fetchMock);
    renderWithToast(<CheckNewPostsButton />);

    await userEvent.click(screen.getByRole("button", { name: "Check for new posts" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/posts/check-new", { method: "POST" });
    expect(await screen.findByText(/Imported & generated 1 new post\./i)).toBeInTheDocument();
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("backlog → 'click again to finish', refresh", async () => {
    vi.stubGlobal("fetch", jsonFetch({ imported: 3, generated: 2, pending: 1 }));
    renderWithToast(<CheckNewPostsButton />);

    await userEvent.click(screen.getByRole("button", { name: "Check for new posts" }));

    expect(
      await screen.findByText(/Generated 2 — 1 more to process\. Click again to finish\./i),
    ).toBeInTheDocument();
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("nothing new → 'No new posts', no refresh", async () => {
    vi.stubGlobal("fetch", jsonFetch({ imported: 0, generated: 0, pending: 0 }));
    renderWithToast(<CheckNewPostsButton />);

    await userEvent.click(screen.getByRole("button", { name: "Check for new posts" }));

    expect(await screen.findByText(/No new posts\./i)).toBeInTheDocument();
    expect(routerMock.refresh).not.toHaveBeenCalled();
  });

  it("server error → error toast", async () => {
    vi.stubGlobal("fetch", errFetch());
    renderWithToast(<CheckNewPostsButton />);

    await userEvent.click(screen.getByRole("button", { name: "Check for new posts" }));

    expect(await screen.findByText(/Couldn't check for new posts/i)).toBeInTheDocument();
  });
});

describe("ConnectionCard", () => {
  it("disconnect → confirm → DELETE, toast", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderWithToast(
      <ConnectionCard
        connection={{
          platform: "LINKEDIN",
          status: "CONNECTED",
          expiresAt: null,
          autoPublish: false,
          autoRenews: false,
        }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/connections?platform=linkedin", {
      method: "DELETE",
    });
    expect(await screen.findByText("LinkedIn disconnected.")).toBeInTheDocument();
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("auto-renewing platform (X) shows 'Auto-renews', not an expiry countdown", () => {
    // X's access token expires within the hour but auto-refreshes on use.
    renderWithToast(
      <ConnectionCard
        connection={{
          platform: "X",
          status: "CONNECTED",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          autoPublish: false,
          autoRenews: true,
        }}
      />,
    );
    expect(screen.getByText(/Auto-renews/)).toBeInTheDocument();
    expect(screen.queryByText(/Expires/)).not.toBeInTheDocument();
  });

  it("non-refreshing platform (LinkedIn) shows the expiry countdown", () => {
    renderWithToast(
      <ConnectionCard
        connection={{
          platform: "LINKEDIN",
          status: "CONNECTED",
          expiresAt: new Date(Date.now() + 58 * 86_400_000).toISOString(),
          autoPublish: false,
          autoRenews: false,
        }}
      />,
    );
    expect(screen.getByText(/Expires in 58 days/)).toBeInTheDocument();
    expect(screen.queryByText(/Auto-renews/)).not.toBeInTheDocument();
  });

  it("a genuinely expired auto-renew token still shows 'Token expired' + Reconnect", () => {
    // Refresh failed → status flipped to TOKEN_EXPIRED; the reassuring label is gone.
    renderWithToast(
      <ConnectionCard
        connection={{
          platform: "X",
          status: "TOKEN_EXPIRED",
          expiresAt: new Date(Date.now() - 3_600_000).toISOString(),
          autoPublish: false,
          autoRenews: true,
        }}
      />,
    );
    expect(screen.getAllByText(/Token expired/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Auto-renews/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reconnect" })).toBeInTheDocument();
  });
});

describe("DeletePostButton", () => {
  it("delete → confirm → DELETE, toast, onDeleted(id)", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    const onDeleted = vi.fn();
    renderWithToast(<DeletePostButton postId="p1" title="My Post" onDeleted={onDeleted} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete post" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/posts/p1", { method: "DELETE" });
    expect(await screen.findByText("Post deleted.")).toBeInTheDocument();
    expect(onDeleted).toHaveBeenCalledWith("p1");
  });

  it("error response → error toast, onDeleted NOT called", async () => {
    vi.stubGlobal("fetch", errFetch());
    const onDeleted = vi.fn();
    renderWithToast(<DeletePostButton postId="p1" title="My Post" onDeleted={onDeleted} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete post" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/Couldn't delete the post/i)).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
