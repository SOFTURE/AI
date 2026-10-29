// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UpdatePrompt, type UpdatePromptProps } from "../../src/notion/UpdatePrompt.js";

afterEach(cleanup);

const COPY = { title: "A new version is ready", description: "Reload to use it.", reload: "Reload" };

function renderPrompt(props: Partial<UpdatePromptProps> = {}) {
  const onReload = vi.fn();
  const result = render(<UpdatePrompt open onReload={onReload} {...COPY} {...props} />);
  return { ...result, onReload };
}

describe("UpdatePrompt", () => {
  it("draws nothing while no new build waits", () => {
    const { container } = renderPrompt({ open: false });

    expect(container.innerHTML).toBe("");
  });

  it("offers the reload as a polite status with the app's copy", () => {
    renderPrompt();
    const status = screen.getByRole("status");

    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("A new version is ready");
    expect(status.textContent).toContain("Reload to use it.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("calls onReload from its button", () => {
    const { onReload } = renderPrompt();

    fireEvent.click(screen.getByRole("button", { name: "Reload" }));

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("floats at the bottom inside the safe-area insets, with a touch-height button that shrinks on a desktop", () => {
    const { container } = renderPrompt({ className: "z-40" });
    const root = container.querySelector('[data-slot="update-prompt"]');

    expect(root?.className).toContain("fixed inset-x-0 bottom-0");
    expect(root?.className).toContain("pb-[calc(--spacing(4)+env(safe-area-inset-bottom))]");
    expect(root?.className).toContain("z-40");
    expect(root?.className).not.toContain("z-50");
    expect(screen.getByRole("button", { name: "Reload" }).className).toContain("h-touch-target");
    expect(screen.getByRole("button", { name: "Reload" }).className).toContain("md:h-7");
  });

  it("hides the icon from assistive technology", () => {
    const { container } = renderPrompt();

    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
