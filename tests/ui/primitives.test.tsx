import {
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Switch } from "@/components/ui/Switch";
import { ToastProvider, useToast } from "@/components/ui/ToastProvider";

describe("Button", () => {
  it("renders children and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("loading → disabled, aria-busy, and does not fire onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disabled → does not fire onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Switch", () => {
  it("reflects checked via aria-checked", () => {
    const { rerender } = render(
      <Switch checked={false} onCheckedChange={() => {}} label="Auto" />,
    );
    const sw = screen.getByRole("switch", { name: "Auto" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    rerender(<Switch checked onCheckedChange={() => {}} label="Auto" />);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("toggles on click and via keyboard (Space)", async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} label="Auto" />);
    const sw = screen.getByRole("switch", { name: "Auto" });

    await userEvent.click(sw);
    expect(onChange).toHaveBeenLastCalledWith(true);

    sw.focus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe("Badge / StatusBadge", () => {
  it("Badge renders its content", () => {
    render(<Badge tone="success">Live</Badge>);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("StatusBadge maps each status to its label", () => {
    const { rerender } = render(<StatusBadge status="PUBLISHED" />);
    expect(screen.getByText("Published")).toBeInTheDocument();
    rerender(<StatusBadge status="FAILED" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    rerender(<StatusBadge status="MANUAL_REQUIRED" />);
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });
});

function ToastHarness({ duration }: { duration: number }): ReactElement {
  const toast = useToast();
  return (
    <button onClick={() => toast.toast({ variant: "success", message: "Saved!", duration })}>
      trigger
    </button>
  );
}

describe("Toast", () => {
  it("shows a toast on trigger, then auto-dismisses", async () => {
    render(
      <ToastProvider>
        <ToastHarness duration={60} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("trigger"));
    expect(screen.getByText("Saved!")).toBeInTheDocument();
    await waitForElementToBeRemoved(() => screen.queryByText("Saved!"));
  });

  it("can be dismissed manually", () => {
    render(
      <ToastProvider>
        <ToastHarness duration={100000} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("trigger"));
    expect(screen.getByText("Saved!")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Dismiss notification"));
    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  const base = {
    open: true,
    title: "Delete this?",
    onConfirm: vi.fn(),
    onOpenChange: vi.fn(),
  };

  it("confirm fires onConfirm", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} confirmLabel="Delete" />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("cancel closes via onOpenChange(false)", async () => {
    const onOpenChange = vi.fn();
    render(<ConfirmDialog {...base} onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("Escape (cancel event) closes via onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    render(<ConfirmDialog {...base} onOpenChange={onOpenChange} />);
    const dialog = document.querySelector("dialog");
    fireEvent(dialog as HTMLDialogElement, new Event("cancel", { cancelable: true }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
