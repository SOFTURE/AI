// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyColumnVisibility,
  TableViewSettings,
  useTableColumns,
  type TableColumnDefinition,
  type TableColumnsState,
  type TableViewColumn,
} from "../../src/index.js";

const ROW_HEIGHT = 40;

// happy-dom has no layout: give every sortable row a rect by its place, so the keyboard reorder works.
beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const row = this.closest("[data-id]");
    const index = row?.parentElement ? [...row.parentElement.children].indexOf(row) : 0;
    return DOMRect.fromRect({ x: 0, y: index * ROW_HEIGHT, width: 256, height: ROW_HEIGHT });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const COLUMNS: readonly TableViewColumn[] = [
  { id: "title", label: "Title", isVisible: true, canHide: false },
  { id: "status", label: "Status", isVisible: false },
  { id: "owner", label: "Owner", isVisible: true },
  { id: "due", label: "Due", isVisible: true },
];

function renderOpen(props: Partial<Parameters<typeof TableViewSettings>[0]> = {}) {
  const onChange = vi.fn();
  const onReorder = vi.fn();
  render(<TableViewSettings columns={COLUMNS} onChange={onChange} onReorder={onReorder} defaultOpen {...props} />);
  return { onChange, onReorder };
}

function getSwitch(name: string): HTMLElement {
  return screen.getByRole("switch", { name });
}

function columnsOf(group: "shown" | "hidden"): string[] {
  return [...document.querySelectorAll(`[data-group="${group}"] [data-column]`)].map((row) => row.getAttribute("data-column") ?? "");
}

// The keyboard sensor listens for the moving keys from the next task on, so each press waits a tick.
async function pressKey(target: HTMLElement, code: string) {
  await act(async () => {
    fireEvent.keyDown(target, { code, key: code });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("TableViewSettings", () => {
  it("renders a ghost icon button named View settings, a touch target on a phone", () => {
    const html = renderToStaticMarkup(<TableViewSettings columns={COLUMNS} onChange={() => undefined} />);

    expect(html).toContain('data-slot="table-view-settings-trigger"');
    expect(html).toContain('aria-label="View settings"');
    expect(html).toContain('data-variant="ghost"');
    expect(html).toContain("max-md:size-touch-target");
  });

  it("names the button with label and the panel with the app's copy", () => {
    renderOpen({ label: "Columns", messages: { title: "Fields", shown: "Visible", hidden: "Not visible" } });

    expect(screen.getByRole("button", { name: "Columns" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Fields" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Visible" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Not visible" })).toBeTruthy();
  });

  it("lists the shown columns first, then the hidden ones, each with a switch named by the column", () => {
    renderOpen();

    expect(document.querySelector('[data-slot="table-view-settings"]')).toBeTruthy();
    expect(columnsOf("shown")).toEqual(["title", "owner", "due"]);
    expect(columnsOf("hidden")).toEqual(["status"]);
    expect(getSwitch("Owner").getAttribute("aria-checked")).toBe("true");
    expect(getSwitch("Status").getAttribute("aria-checked")).toBe("false");
  });

  it("reports the visible ids in the columns' order when a column is shown or hidden", () => {
    const { onChange } = renderOpen();

    fireEvent.click(getSwitch("Status"));
    expect(onChange).toHaveBeenLastCalledWith(["title", "status", "owner", "due"]);

    fireEvent.click(getSwitch("Owner"));
    expect(onChange).toHaveBeenLastCalledWith(["title", "due"]);
  });

  it("disables the switch of a column that cannot be hidden and keeps it through Hide all", () => {
    const { onChange } = renderOpen();

    expect(getSwitch("Title").hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Hide all" }));

    expect(onChange).toHaveBeenLastCalledWith(["title"]);
  });

  it("shows every column with Show all", () => {
    const { onChange } = renderOpen();

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(onChange).toHaveBeenLastCalledWith(["title", "status", "owner", "due"]);
  });

  it("offers Hide all only when a shown column can be hidden, and Show all only when a column is hidden", () => {
    renderOpen({ columns: [{ id: "title", label: "Title", isVisible: true, canHide: false }] });

    expect(screen.queryByRole("button", { name: "Hide all" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
    expect(document.querySelector('[data-group="hidden"]')).toBeNull();
  });

  it("renders no shown group when every column is hidden", () => {
    renderOpen({ columns: COLUMNS.map((column) => ({ ...column, isVisible: false, canHide: true })) });

    expect(document.querySelector('[data-group="shown"]')).toBeNull();
    expect(columnsOf("hidden")).toEqual(["title", "status", "owner", "due"]);
  });

  it("has no drag handles unless canReorder", () => {
    renderOpen();

    expect(document.querySelector('[data-slot="sortable-list"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Drag to reorder" })).toBeNull();
  });

  it("reorders the shown columns by keyboard, keeping the hidden ones in their slots", async () => {
    const { onReorder } = renderOpen({ canReorder: true });

    expect(screen.getByRole("list", { name: "Column order" })).toBeTruthy();
    const handle = document.querySelector<HTMLElement>('[data-id="due"] [data-slot="sortable-handle"]');
    if (handle === null) throw new Error("no handle for due");

    await pressKey(handle, "Space");
    await pressKey(handle, "ArrowUp");
    await pressKey(handle, "Space");

    expect(onReorder).toHaveBeenCalledWith(["title", "status", "due", "owner"]);
  });
});

describe("applyColumnVisibility", () => {
  const definitions = [{ id: "a" }, { id: "b" }, { id: "c" }] as const;

  it("returns nothing for no visible ids", () => {
    expect(applyColumnVisibility(definitions, [])).toEqual([]);
  });

  it("keeps the definitions' order without an order and ignores unknown ids", () => {
    expect(applyColumnVisibility(definitions, ["c", "x", "a"])).toEqual([{ id: "a" }, { id: "c" }]);
  });

  it("follows the order, with ids it does not name last in their own order", () => {
    expect(applyColumnVisibility(definitions, ["a", "b", "c"], ["c", "a"])).toEqual([{ id: "c" }, { id: "a" }, { id: "b" }]);
  });
});

describe("useTableColumns", () => {
  const definitions: readonly TableColumnDefinition[] = [
    { id: "title", label: "Title", canHide: false },
    { id: "status", label: "Status" },
    { id: "notes", label: "Notes", isVisibleByDefault: false },
  ];

  function memoryStore(initial: TableColumnsState | null) {
    return { load: vi.fn(() => initial), save: vi.fn() };
  }

  it("starts from the definitions' order and default visibility", () => {
    const { result } = renderHook(() => useTableColumns({ columns: definitions }));

    expect(result.current.visibleIds).toEqual(["title", "status"]);
    expect(result.current.order).toEqual(["title", "status", "notes"]);
    expect(result.current.columns).toEqual([
      { id: "title", label: "Title", isVisible: true, canHide: false },
      { id: "status", label: "Status", isVisible: true },
      { id: "notes", label: "Notes", isVisible: false },
    ]);
  });

  it("loads the store after mount, dropping unknown ids, adding new columns and keeping always-shown ones", () => {
    const store = memoryStore({ visible: ["gone", "notes"], order: ["notes", "gone", "title"] });
    const { result } = renderHook(() => useTableColumns({ columns: definitions, store }));

    expect(store.load).toHaveBeenCalledTimes(1);
    expect(result.current.order).toEqual(["notes", "title", "status"]);
    expect(result.current.visibleIds).toEqual(["notes", "title", "status"]);
    expect(store.save).not.toHaveBeenCalled();
  });

  it("saves every change and resets to the defaults", () => {
    const store = memoryStore(null);
    const { result } = renderHook(() => useTableColumns({ columns: definitions, store }));

    act(() => result.current.setVisibleIds(["status"]));
    expect(result.current.visibleIds).toEqual(["title", "status"]);
    expect(store.save).toHaveBeenLastCalledWith({ visible: ["title", "status"], order: ["title", "status", "notes"] });

    act(() => result.current.setOrder(["notes", "status", "title"]));
    expect(result.current.order).toEqual(["notes", "status", "title"]);
    expect(store.save).toHaveBeenLastCalledWith({ visible: ["status", "title"], order: ["notes", "status", "title"] });

    act(() => result.current.reset());
    expect(result.current.visibleIds).toEqual(["title", "status"]);
    expect(result.current.order).toEqual(["title", "status", "notes"]);
  });
});
