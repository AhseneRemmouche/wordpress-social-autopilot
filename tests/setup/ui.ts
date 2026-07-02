import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom doesn't implement matchMedia; polyfill for ThemeToggle's OS-preference read.
window.matchMedia = ((query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList) as typeof window.matchMedia;

// jsdom doesn't implement <dialog> showModal()/close(); polyfill for ConfirmDialog.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
  this.open = true;
};
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
  if (!this.open) return;
  this.open = false;
  this.dispatchEvent(new Event("close"));
};

// Registers jest-dom matchers (toBeInTheDocument, …) and unmounts rendered trees
// after each UI test. Manual cleanup is required because globals are disabled.
afterEach(() => {
  cleanup();
});
