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
  copyText: "Hello world\n\n#a\nhttps://blog.example.com/p",
  featuredImageUrl: null,
  publishedUrl: null,
  lastError: null,
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

  it("PUBLISHED with a URL shows a 'View on <platform>' link", () => {
    const published: ContentPreview = {
      ...pending,
      platform: "FACEBOOK",
      status: "PUBLISHED",
      publishedUrl: "https://www.facebook.com/515_123",
    };
    renderWithToast(<PlatformPreviewCard content={published} />);

    const link = screen.getByRole("link", { name: /view on facebook/i });
    expect(link).toHaveAttribute("href", "https://www.facebook.com/515_123");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("PUBLISHED without a URL shows no 'View on' link", () => {
    const published: ContentPreview = {
      ...pending,
      platform: "TIKTOK",
      status: "PUBLISHED",
      publishedUrl: null,
    };
    renderWithToast(<PlatformPreviewCard content={published} />);
    expect(screen.queryByRole("link", { name: /view on/i })).not.toBeInTheDocument();
  });

  it("FAILED card shows the recorded error reason", () => {
    const failed: ContentPreview = {
      ...pending,
      status: "FAILED",
      lastError: "LinkedIn publish failed (HTTP 400)",
    };
    renderWithToast(<PlatformPreviewCard content={failed} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Failed:\s*LinkedIn publish failed \(HTTP 400\)/i);
  });

  it("non-FAILED card shows no error note", () => {
    renderWithToast(<PlatformPreviewCard content={{ ...pending, lastError: "should not show" }} />);
    expect(screen.queryByText(/should not show/i)).not.toBeInTheDocument();
  });

  it("edit → textarea appears, Save PATCHes the new body", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderWithToast(<PlatformPreviewCard content={pending} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByRole("textbox", { name: /edit linkedin caption/i });
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Edited caption");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/content/c1", expect.objectContaining({ method: "PATCH" }));
    const sent = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(sent.body).toBe("Edited caption");
    expect(await screen.findByText(/caption updated/i)).toBeInTheDocument();
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("edit → Cancel exits without saving", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderWithToast(<PlatformPreviewCard content={pending} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("regenerate → POSTs to the regenerate endpoint", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderWithToast(<PlatformPreviewCard content={pending} />);

    await userEvent.click(screen.getByRole("button", { name: "Regenerate" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/content/c1/regenerate", { method: "POST" });
    expect(await screen.findByText(/regenerated a fresh caption/i)).toBeInTheDocument();
    expect(routerMock.refresh).toHaveBeenCalled();
  });

  it("PUBLISHED card offers neither Edit nor Regenerate", () => {
    renderWithToast(
      <PlatformPreviewCard
        content={{ ...pending, status: "PUBLISHED", publishedUrl: "https://x/1" }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerate" })).not.toBeInTheDocument();
  });

  it("YouTube (Manual) card links to where you post it", () => {
    const yt: ContentPreview = { ...pending, platform: "YOUTUBE", status: "MANUAL_REQUIRED" };
    renderWithToast(<PlatformPreviewCard content={yt} />);

    const link = screen.getByRole("link", { name: /post on youtube/i });
    expect(link).toHaveAttribute("href", "https://studio.youtube.com");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("auto-publish platforms (LinkedIn) show no 'Post on' link", () => {
    renderWithToast(<PlatformPreviewCard content={pending} />);
    expect(screen.queryByRole("link", { name: /post on/i })).not.toBeInTheDocument();
  });

  it("copy → writes the full caption to the clipboard + toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderWithToast(<PlatformPreviewCard content={pending} />);

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith(pending.copyText);
    expect(await screen.findByText(/copied to clipboard/i)).toBeInTheDocument();
  });

  it("MANUAL_REQUIRED → 'Mark as published' POSTs mark-published, optimistic PUBLISHED", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    const manual: ContentPreview = { ...pending, contentId: "c9", status: "MANUAL_REQUIRED" };
    renderWithToast(<PlatformPreviewCard content={manual} />);

    // Manual cards have no Approve/Reject, but do have Mark as published.
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mark as published" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/content/c9/mark-published", { method: "POST" });
    expect(await screen.findByText(/marked as published/i)).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument(); // optimistic badge
    expect(routerMock.refresh).toHaveBeenCalled();
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
