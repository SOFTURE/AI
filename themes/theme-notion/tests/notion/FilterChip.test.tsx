// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CircleDot } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import * as theme from "../../src/index.js";
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "../../src/ui/dropdown-menu.js";
import { FilterChip, FilterChipAdd, type FilterChipProps } from "../../src/notion/FilterChip.js";

afterEach(cleanup);

function renderChip(props: Partial<FilterChipProps> = {}) {
  return render(
    <FilterChip label="Status:" value="all" icon={<CircleDot aria-hidden="true" />} {...props}>
      <DropdownMenuRadioGroup value="all">
        <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="failed">Failed</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </FilterChip>,
  );
}

function getChip(): HTMLElement {
  return screen.getByRole("button", { name: "Status: all" });
}

describe("FilterChip", () => {
  it("draws the icon, the label, the value and the chevron in a menu button", () => {
    renderChip();
    const chip = getChip();

    expect(chip.tagName).toBe("BUTTON");
    expect(chip.getAttribute("type")).toBe("button");
    expect(chip.getAttribute("data-slot")).toBe("filter-chip");
    expect(chip.getAttribute("aria-haspopup")).toBe("menu");
    expect(chip.getAttribute("aria-expanded")).toBe("false");
    expect([...chip.children].map((child) => child.tagName.toLowerCase())).toEqual(["svg", "span", "span", "svg"]);
    expect(chip.querySelector('[data-slot="filter-chip-value"]')?.textContent).toBe("all");
    expect(chip.lastElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(chip.className).toMatch(/\bh-6\b/);
    expect(chip.className).toMatch(/\brounded-full\b/);
  });

  it("is muted with no data-active while the default value is chosen", () => {
    renderChip();
    const chip = getChip();

    expect(chip.hasAttribute("data-active")).toBe(false);
    expect(chip.className).toMatch(/\btext-muted-foreground\b/);
  });

  it("marks a chosen value with data-active and the blue tag", () => {
    renderChip({ value: "failed", isActive: true });
    const chip = screen.getByRole("button", { name: "Status: failed" });

    expect(chip.getAttribute("data-active")).toBe("");
    expect(chip.className).toMatch(/\bdata-\[active\]:bg-blue-tag\b/);
    expect(chip.className).toMatch(/\bdata-\[active\]:text-blue-tag-foreground\b/);
  });

  it("opens the options in the popover on pointer down", () => {
    renderChip();
    const chip = getChip();
    fireEvent.pointerDown(chip, { button: 0, ctrlKey: false });

    expect(chip.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("menu").getAttribute("data-slot")).toBe("dropdown-menu-content");
    expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(["All", "Failed"]);
  });

  it("opens the options from the keyboard", () => {
    renderChip();
    fireEvent.keyDown(getChip(), { key: "Enter" });

    expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(["All", "Failed"]);
  });

  it("keeps the caller's className", () => {
    renderChip({ className: "ml-2" });

    expect(getChip().className).toMatch(/\bml-2\b/);
  });

  it("is exported from the package root", () => {
    expect(theme.FilterChip).toBe(FilterChip);
    expect(theme.FilterChipAdd).toBe(FilterChipAdd);
  });
});

describe("FilterChipAdd", () => {
  function renderAdd(label?: string) {
    return render(
      <FilterChipAdd label={label}>
        <DropdownMenuRadioGroup>
          <DropdownMenuRadioItem value="status">Status</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </FilterChipAdd>,
    );
  }

  it("draws a plus and the built-in label in a ghost pill of the same height", () => {
    renderAdd();
    const add = screen.getByRole("button", { name: theme.notionMessages.en.filterChip.add });

    expect(add.textContent).toBe("Add filter");
    expect(add.getAttribute("data-slot")).toBe("filter-chip-add");
    expect(add.getAttribute("aria-haspopup")).toBe("menu");
    expect(add.hasAttribute("data-active")).toBe(false);
    expect(add.className).toMatch(/\bh-6\b/);
    expect(add.className).not.toMatch(/blue-tag/);
    expect(add.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("takes the app's own wording and opens its menu", () => {
    renderAdd("Filter");
    const add = screen.getByRole("button", { name: "Filter" });
    fireEvent.pointerDown(add, { button: 0, ctrlKey: false });

    expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(["Status"]);
  });
});
