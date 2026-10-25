// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TriangleAlert } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import * as theme from "../../src/index.js";
import { MarkPopover, type MarkPopoverProps } from "../../src/notion/MarkPopover.js";

afterEach(cleanup);

function renderMark(props: Partial<MarkPopoverProps> = {}) {
  return render(
    <MarkPopover
      color="red"
      icon={TriangleAlert}
      count={3}
      label="3 open warnings, opens the list"
      heading="Open warnings"
      closeLabel="Close"
      {...props}
    >
      {props.children ?? (
        <>
          <span role="listitem">Loan payment is overdue</span>
          <span role="listitem">
            <a href="/tickets">See the tickets</a>
          </span>
        </>
      )}
    </MarkPopover>,
  );
}

function getPanel(container: HTMLElement): HTMLElement {
  const panel = container.querySelector<HTMLElement>('[data-slot="mark-popover"]');
  if (panel === null) throw new Error("MarkPopover rendered no panel");
  return panel;
}

describe("MarkPopover", () => {
  it("targets its panel from the mark and hides it from the close button", () => {
    const { container } = renderMark();
    const panel = getPanel(container);
    const mark = screen.getByRole("button", { name: "3 open warnings, opens the list" });
    const close = screen.getByRole("button", { name: "Close" });

    expect(panel.id).not.toBe("");
    expect(panel.getAttribute("popover")).toBe("auto");
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(mark.getAttribute("popovertarget")).toBe(panel.id);
    expect(mark.getAttribute("aria-haspopup")).toBe("dialog");
    expect(close.getAttribute("popovertarget")).toBe(panel.id);
    expect(close.getAttribute("popovertargetaction")).toBe("hide");
    expect(document.getElementById(panel.getAttribute("aria-labelledby") ?? "")?.textContent).toBe("Open warnings");
  });

  it("shows the count in the palette colour's tag, with the icon and count hidden from the name", () => {
    const { container } = renderMark();
    const mark = screen.getByRole("button", { name: "3 open warnings, opens the list" });

    expect(container.firstElementChild?.getAttribute("data-slot")).toBe("mark");
    expect(mark.className).toMatch(/\bbg-red-tag\b/);
    expect(mark.className).toMatch(/\btext-red-tag-foreground\b/);
    expect(mark.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(mark.querySelector("span")?.getAttribute("aria-hidden")).toBe("true");
    expect(mark.textContent).toBe("3");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Loan payment is overdue",
      "See the tickets",
    ]);
  });

  it("keeps buttonData on the mark button", () => {
    renderMark({ buttonData: { "data-kind": "warnings", "data-empty": undefined } });
    const mark = screen.getByRole("button", { name: "3 open warnings, opens the list" });

    expect(mark.getAttribute("data-kind")).toBe("warnings");
    expect(mark.hasAttribute("data-empty")).toBe(false);
  });

  it("uses phrasing elements only, so it fits in a summary or a paragraph", () => {
    const { container } = renderMark();
    const tags = new Set([...container.querySelectorAll("*")].map((element) => element.tagName.toLowerCase()));

    expect([...tags].sort()).toEqual(["a", "button", "path", "span", "svg"]);
  });

  it("prevents the default of a click on panel text, so an enclosing details stays as it is", () => {
    const { container } = renderMark();
    const text = screen.getByText("Loan payment is overdue");

    expect(fireEvent.click(text)).toBe(false);
    expect(fireEvent.click(getPanel(container))).toBe(false);
  });

  it("lets a click on a link or a button inside the panel through", () => {
    renderMark();

    expect(fireEvent.click(screen.getByRole("link", { name: "See the tickets" }))).toBe(true);
    expect(fireEvent.click(screen.getByRole("button", { name: "Close" }))).toBe(true);
  });

  it("is exported from the package root", () => {
    expect(theme.MarkPopover).toBe(MarkPopover);
  });
});
