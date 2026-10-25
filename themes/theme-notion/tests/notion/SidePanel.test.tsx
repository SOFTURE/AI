// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidePanel, type SidePanelLayout } from "../../src/index.js";

afterEach(cleanup);

function renderPanel({
  isOpen = true,
  layout = "over",
  onClose = vi.fn(),
  closeLabel,
}: { isOpen?: boolean; layout?: SidePanelLayout; onClose?: () => void; closeLabel?: string } = {}) {
  return render(
    <SidePanel id="layers" heading="Layers" layout={layout} isOpen={isOpen} onClose={onClose} closeLabel={closeLabel}>
      <label>
        <input type="checkbox" /> Traffic
      </label>
    </SidePanel>,
  );
}

describe("SidePanel", () => {
  it("renders a labelled aside with its slots, layout and test id", () => {
    renderPanel({ layout: "beside" });
    const panel = screen.getByTestId("layers");

    expect(panel.tagName).toBe("ASIDE");
    expect(panel.id).toBe("layers");
    expect(panel.dataset["slot"]).toBe("side-panel");
    expect(panel.dataset["layout"]).toBe("beside");
    expect(panel.getAttribute("aria-labelledby")).toBe("layers-heading");
    expect(screen.getByRole("heading", { level: 2 }).id).toBe("layers-heading");
    expect(screen.getByRole("complementary", { name: "Layers" })).toBe(panel);
    expect(panel.querySelector('[data-slot="side-panel-content"]')?.textContent).toBe(" Traffic");
  });

  it("is hidden while closed, so its content leaves the reading order", () => {
    renderPanel({ isOpen: false });

    expect(screen.getByTestId("layers").hidden).toBe(true);
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("moves focus into the panel when it opens", () => {
    const view = renderPanel({ isOpen: false });
    expect(document.activeElement).toBe(document.body);

    view.rerender(
      <SidePanel id="layers" heading="Layers" layout="over" isOpen onClose={vi.fn()}>
        content
      </SidePanel>,
    );

    expect(document.activeElement).toBe(screen.getByTestId("layers"));
  });

  it("leaves focus alone when the panel is open on first render", () => {
    renderPanel({ isOpen: true });

    expect(document.activeElement).toBe(document.body);
  });

  it("calls onClose on Escape inside, without letting the key reach the page", () => {
    const onClose = vi.fn();
    const onPageKeyDown = vi.fn();
    document.addEventListener("keydown", onPageKeyDown);
    renderPanel({ onClose });

    fireEvent.keyDown(screen.getByRole("checkbox"), { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("checkbox"), { key: "Enter" });
    document.removeEventListener("keydown", onPageKeyDown);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPageKeyDown.mock.calls.map(([event]) => (event as KeyboardEvent).key)).toEqual(["Enter"]);
  });

  it("calls onClose from the close button, named Close by default", () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("takes the app's own name for the close button", () => {
    renderPanel({ closeLabel: "Hide layers" });

    expect(screen.getByRole("button", { name: "Hide layers" }).dataset["slot"]).toBe("button");
  });
});
