// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Table, TableHeader, TableRow } from "../../src/ui/table.js";
import { nextSortDirection, sortRows, type SortDirection } from "../../src/notion/sort-rows.js";
import { TableSortHead } from "../../src/notion/TableSortHead.js";

afterEach(cleanup);

function renderHead(direction: SortDirection, props: Partial<Parameters<typeof TableSortHead>[0]> = {}) {
  const onSortChange = vi.fn<(next: SortDirection) => void>();
  render(
    <Table>
      <TableHeader>
        <TableRow>
          <TableSortHead direction={direction} onSortChange={onSortChange} {...props}>
            Amount
          </TableSortHead>
        </TableRow>
      </TableHeader>
    </Table>,
  );
  return { onSortChange, head: screen.getByRole("columnheader"), button: screen.getByRole("button") };
}

describe("nextSortDirection", () => {
  it("cycles none, descending, ascending and back to none by default", () => {
    expect(nextSortDirection("none")).toBe("descending");
    expect(nextSortDirection("descending")).toBe("ascending");
    expect(nextSortDirection("ascending")).toBe("none");
  });

  it("never returns to none in the two-state cycle", () => {
    expect(nextSortDirection("none", "two-state")).toBe("descending");
    expect(nextSortDirection("descending", "two-state")).toBe("ascending");
    expect(nextSortDirection("ascending", "two-state")).toBe("descending");
  });
});

describe("TableSortHead", () => {
  it("renders a table head with a ghost button holding the label, and no aria-sort when unsorted", () => {
    const { head, button } = renderHead("none");

    expect(head.tagName).toBe("TH");
    expect(head.getAttribute("data-slot")).toBe("table-sort-head");
    expect(head.getAttribute("data-sort")).toBe("none");
    expect(head.hasAttribute("aria-sort")).toBe(false);
    expect(button.getAttribute("data-slot")).toBe("table-sort-button");
    expect(button.getAttribute("data-variant")).toBe("ghost");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.textContent).toBe("AmountSort descending");
  });

  it.each([
    ["descending", "descending", "lucide-chevron-down", "Sort ascending"],
    ["ascending", "ascending", "lucide-chevron-up", "Remove sorting"],
  ] as const)("sets aria-sort %s and its chevron on the sorted column", (direction, ariaSort, iconClass, hidden) => {
    const { head, button } = renderHead(direction);

    expect(head.getAttribute("aria-sort")).toBe(ariaSort);
    expect(head.getAttribute("data-sort")).toBe(direction);
    const icon = button.querySelector("svg");
    expect(icon?.getAttribute("class")).toContain(iconClass);
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.getAttribute("class")).not.toContain("opacity-50");
    expect(button.querySelector('[data-slot="table-sort-label"]')?.textContent).toBe(hidden);
  });

  it("draws a muted up-down chevron when unsorted", () => {
    const { button } = renderHead("none");

    const icon = button.querySelector("svg");
    expect(icon?.getAttribute("class")).toContain("lucide-chevrons-up-down");
    expect(icon?.getAttribute("class")).toContain("opacity-50");
    expect(icon?.getAttribute("stroke-width")).toBe("1.75");
  });

  it("asks for the next direction on a click", () => {
    const { onSortChange, button } = renderHead("descending");

    fireEvent.click(button);

    expect(onSortChange).toHaveBeenCalledExactlyOnceWith("ascending");
  });

  it("follows the two-state cycle when asked", () => {
    const { onSortChange, button } = renderHead("ascending", { cycle: "two-state" });

    fireEvent.click(button);

    expect(onSortChange).toHaveBeenCalledExactlyOnceWith("descending");
    expect(button.textContent).toBe("AmountSort descending");
  });

  it("is a focusable native button, so Enter and Space toggle it", () => {
    const { button } = renderHead("none");

    button.focus();

    expect(document.activeElement).toBe(button);
    expect(button.tagName).toBe("BUTTON");
    expect(button.hasAttribute("tabindex")).toBe(false);
  });

  it("announces the app's text instead of the English default", () => {
    const { button } = renderHead("none", { label: "Order by amount, highest first" });

    expect(button.querySelector('[data-slot="table-sort-label"]')?.textContent).toBe("Order by amount, highest first");
    expect(button.querySelector('[data-slot="table-sort-label"]')?.getAttribute("class")).toBe("sr-only");
  });

  it("aligns the button to the end of a right-aligned column and passes th props through", () => {
    const html = renderToStaticMarkup(
      <table>
        <thead>
          <tr>
            <TableSortHead direction="none" onSortChange={() => undefined} align="end" className="w-24" scope="col">
              Amount
            </TableSortHead>
          </tr>
        </thead>
      </table>,
    );

    expect(html).toContain('scope="col"');
    expect(html).toMatch(/data-slot="table-sort-head"[^>]*class="[^"]*text-right[^"]*w-24/);
    expect(html).toMatch(/data-slot="table-sort-button"[^>]*class="[^"]*-mr-2/);
  });
});

interface Row {
  readonly id: number;
  readonly name: string;
  readonly amount: number | null;
  readonly due?: Date;
}

const ROWS: readonly Row[] = [
  { id: 1, name: "Item 10", amount: 300, due: new Date("2026-03-01") },
  { id: 2, name: "item 2", amount: null },
  { id: 3, name: "Item 1", amount: 100, due: new Date("2026-01-01") },
  { id: 4, name: "Item 3", amount: 300, due: new Date("2026-02-01") },
  { id: 5, name: "Item 20", amount: 100 },
];

const ids = (rows: readonly Row[]): number[] => rows.map((row) => row.id);

describe("sortRows", () => {
  it("keeps the input order for none and returns a new array", () => {
    const sorted = sortRows(ROWS, "amount", "none");

    expect(ids(sorted)).toEqual([1, 2, 3, 4, 5]);
    expect(sorted).not.toBe(ROWS);
  });

  it("sorts numbers ascending, keeps equal rows in order and puts empty values last", () => {
    expect(ids(sortRows(ROWS, "amount", "ascending"))).toEqual([3, 5, 1, 4, 2]);
  });

  it("sorts descending without flipping equal rows, empty values still last", () => {
    expect(ids(sortRows(ROWS, "amount", "descending"))).toEqual([1, 4, 3, 5, 2]);
  });

  it("compares strings with numeric collation, ignoring case", () => {
    expect(ids(sortRows(ROWS, "name", "ascending"))).toEqual([3, 2, 4, 1, 5]);
  });

  it("compares dates by time and takes an accessor for the key", () => {
    expect(ids(sortRows(ROWS, (row) => row.due, "descending"))).toEqual([1, 4, 3, 2, 5]);
  });

  it("uses the app's comparison, still stable and negated for descending", () => {
    const byLength = (left: unknown, right: unknown): number => String(left).length - String(right).length;

    expect(ids(sortRows(ROWS, "name", "descending", byLength))).toEqual([1, 5, 2, 3, 4]);
  });

  it("sorts booleans false first and leaves the input untouched", () => {
    const flags = [
      { id: 1, done: true },
      { id: 2, done: false },
      { id: 3, done: true },
    ];

    expect(sortRows(flags, "done", "ascending").map((row) => row.id)).toEqual([2, 1, 3]);
    expect(flags.map((row) => row.id)).toEqual([1, 2, 3]);
  });
});
