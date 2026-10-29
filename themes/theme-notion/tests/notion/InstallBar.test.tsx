// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InstallBar, type InstallBarProps } from "../../src/notion/InstallBar.js";

afterEach(cleanup);

const COPY = {
  title: "Install the app",
  description: "Open it from your home screen.",
  install: "Install",
  shareStep: "Tap Share",
  addStep: "Choose Add to Home Screen",
  close: "Close",
};

function renderBar(props: Partial<InstallBarProps> = {}) {
  const onInstall = vi.fn();
  const onClose = vi.fn();
  const result = render(<InstallBar offer="browser_prompt" onInstall={onInstall} onClose={onClose} {...COPY} {...props} />);
  return { ...result, onInstall, onClose };
}

describe("InstallBar", () => {
  it("draws nothing without an offer", () => {
    const { container } = renderBar({ offer: "none" });

    expect(container.innerHTML).toBe("");
  });

  it("offers the browser's prompt as a polite status with the app's copy", () => {
    const { onInstall } = renderBar();
    const status = screen.getByRole("status");

    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Install the app");
    expect(status.textContent).toContain("Open it from your home screen.");
    expect(screen.queryByRole("list")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("shows the two iOS steps in order instead of a button", () => {
    renderBar({ offer: "ios_steps" });
    const steps = screen.getAllByRole("listitem").map((item) => item.textContent);

    expect(steps).toEqual(["Tap Share", "Choose Add to Home Screen"]);
    expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
  });

  it("closes from its labelled close button with either offer", () => {
    for (const offer of ["browser_prompt", "ios_steps"] as const) {
      const { onClose } = renderBar({ offer });

      fireEvent.click(screen.getByRole("button", { name: "Close" }));

      expect(onClose).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it("floats at the bottom inside the safe-area insets, with touch-size buttons that shrink on a desktop", () => {
    const { container } = renderBar({ className: "z-40" });
    const root = container.querySelector('[data-slot="install-bar"]');

    expect(root?.getAttribute("data-offer")).toBe("browser_prompt");
    expect(root?.className).toContain("fixed inset-x-0 bottom-0");
    expect(root?.className).toContain("pb-[calc(--spacing(4)+env(safe-area-inset-bottom))]");
    expect(root?.className).toContain("z-40");
    expect(root?.className).not.toContain("z-50");
    expect(screen.getByRole("button", { name: "Install" }).className).toContain("h-touch-target");
    expect(screen.getByRole("button", { name: "Install" }).className).toContain("md:h-7");
    expect(screen.getByRole("button", { name: "Close" }).className).toContain("size-touch-target");
    expect(screen.getByRole("button", { name: "Close" }).className).toContain("md:size-7");
  });

  it("hides every icon from assistive technology", () => {
    const { container } = renderBar({ offer: "ios_steps" });
    const icons = [...container.querySelectorAll("svg")];

    expect(icons).toHaveLength(4);
    expect(icons.every((icon) => icon.getAttribute("aria-hidden") === "true")).toBe(true);
  });
});
