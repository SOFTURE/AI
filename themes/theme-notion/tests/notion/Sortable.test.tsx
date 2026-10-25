// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  notionMessages,
  SortableHandle,
  SortableItem,
  SortableList,
  type SortableAnnouncements,
  type SortableDragBy,
} from "../../src/index.js";

const ROW_HEIGHT = 40;

// happy-dom has no layout: give every row a rect by its place in the list, so collisions and the keyboard work.
beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const row = this.closest("[data-id]");
    const index = row?.parentElement ? [...row.parentElement.children].indexOf(row) : 0;
    const top = index * ROW_HEIGHT;
    return DOMRect.fromRect({ x: 0, y: top, width: 320, height: ROW_HEIGHT });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ITEMS = ["milk", "bread", "eggs"];

function renderList({
  dragBy = "row",
  onReorder = vi.fn(),
  announcements,
  instructions,
}: {
  dragBy?: SortableDragBy;
  onReorder?: (next: string[]) => void;
  announcements?: Partial<SortableAnnouncements>;
  instructions?: string;
} = {}) {
  return render(
    <SortableList
      label="Shopping list"
      items={ITEMS}
      onReorder={onReorder}
      dragBy={dragBy}
      announcements={announcements}
      instructions={instructions}
      getItemLabel={(id) => id.toUpperCase()}
    >
      {ITEMS.map((id) => (
        <SortableItem key={id} id={id}>
          {dragBy === "handle" ? <SortableHandle /> : null}
          {id}
        </SortableItem>
      ))}
    </SortableList>,
  );
}

function getRow(id: string): HTMLElement {
  const row = document.querySelector<HTMLElement>(`[data-slot="sortable-item"][data-id="${id}"]`);
  if (!row) throw new Error(`getRow failed: no row ${id}`);
  return row;
}

// The keyboard sensor listens for the moving keys from the next task on, so each press waits a tick.
async function pressKey(target: HTMLElement, code: string) {
  await act(async () => {
    fireEvent.keyDown(target, { code, key: code });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function getLiveRegionText(): string {
  return [...document.querySelectorAll('[role="status"]')].map((node) => node.textContent).join(" ");
}

describe("SortableList", () => {
  it("renders a labelled list of rows with their slots", () => {
    renderList();
    const list = screen.getByRole("list", { name: "Shopping list" });

    expect(list.dataset["slot"]).toBe("sortable-list");
    expect(list.dataset["dragBy"]).toBe("row");
    expect(screen.getAllByRole("listitem").map((row) => row.dataset["id"])).toEqual(ITEMS);
    expect(getRow("milk").hasAttribute("data-dragging")).toBe(false);
  });

  it("makes the row the drag target in row mode, focusable and described by the instructions", () => {
    renderList({ instructions: "Hold to move" });
    const row = getRow("milk");

    expect(row.getAttribute("role")).toBe("listitem");
    expect(row.tabIndex).toBe(0);
    expect(row.getAttribute("aria-roledescription")).toBe("sortable");
    const description = document.getElementById(row.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toBe("Hold to move");
  });

  it("carries the touch defaults and the lifted look as literal classes", () => {
    renderList();
    const classes = getRow("milk").className;

    for (const name of [
      "touch-manipulation",
      "select-none",
      "[-webkit-touch-callout:none]",
      "data-[dragging]:bg-accent-strong",
      "data-[dragging]:shadow-menu",
      "data-[dragging]:z-10",
    ]) {
      expect(classes).toContain(name);
    }
  });

  it("moves a row with the keyboard and reports the new order", async () => {
    const onReorder = vi.fn();
    renderList({ onReorder });
    const row = getRow("milk");

    await pressKey(row, "Space");
    expect(row.hasAttribute("data-dragging")).toBe(true);
    await pressKey(row, "ArrowDown");
    expect(getLiveRegionText()).toContain("MILK moved to position 2 of 3.");
    await pressKey(row, "Space");

    expect(onReorder).toHaveBeenCalledWith(["bread", "milk", "eggs"], { id: "milk", from: 0, to: 1 });
  });

  it("leaves the order alone when the drag is cancelled", async () => {
    const onReorder = vi.fn();
    renderList({ onReorder });
    const row = getRow("milk");

    await pressKey(row, "Space");
    await pressKey(row, "ArrowDown");
    await pressKey(row, "Escape");

    expect(onReorder).not.toHaveBeenCalled();
    expect(row.hasAttribute("data-dragging")).toBe(false);
  });

  it("announces with the built-in English copy by default", async () => {
    renderList();
    await pressKey(getRow("bread"), "Space");

    expect(getLiveRegionText()).toContain("Picked up BREAD, position 2 of 3.");
    expect(notionMessages.en.sortable.pickedUp).toBe("Picked up {item}, position {position} of {total}.");
  });

  it("announces with the app's own wording", async () => {
    renderList({ announcements: { pickedUp: "Lifted {item} ({position}/{total})" } });
    await pressKey(getRow("eggs"), "Enter");

    expect(getLiveRegionText()).toContain("Lifted EGGS (3/3)");
  });

  it("moves the drag target to the handle in handle mode", () => {
    renderList({ dragBy: "handle" });
    const row = getRow("milk");
    const handle = screen.getAllByRole("button", { name: notionMessages.en.sortable.handle })[0];
    if (!handle) throw new Error("no handle");

    expect(row.hasAttribute("tabindex")).toBe(false);
    expect(row.hasAttribute("aria-roledescription")).toBe(false);
    expect(handle.dataset["slot"]).toBe("sortable-handle");
    expect(handle.getAttribute("aria-roledescription")).toBe("sortable");
    expect(row.contains(handle)).toBe(true);
  });

  it("names the handle in the app's wording", () => {
    render(
      <SortableList label="List" items={["a"]} onReorder={vi.fn()} dragBy="handle">
        <SortableItem id="a">
          <SortableHandle label="Move" />a
        </SortableItem>
      </SortableList>,
    );

    expect(screen.getByRole("button", { name: "Move" })).toBeDefined();
  });
});
