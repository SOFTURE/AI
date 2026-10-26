// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  notionMessages,
  SortableActivator,
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

// A mouse press held past the list's `holdDelay` (10 ms in these tests), so the row lifts.
async function holdMouse(target: HTMLElement) {
  await act(async () => {
    fireEvent.mouseDown(target, { button: 0, clientX: 10, clientY: 10 });
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

async function releaseMouse() {
  await act(async () => {
    fireEvent.mouseUp(document, { button: 0, clientX: 10, clientY: 10 });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// dnd-kit swallows clicks for 50 ms after a pointer drag ends; a test that clicks afterwards waits it out.
async function waitForClickGrace() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
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

describe("SortableList disabled", () => {
  function renderDisabled({ listDisabled, itemDisabled }: { listDisabled?: boolean; itemDisabled?: boolean }) {
    const onRowClick = vi.fn();
    render(
      <SortableList label="Day" items={ITEMS} onReorder={vi.fn()} disabled={listDisabled}>
        {ITEMS.map((id) => (
          <SortableItem key={id} id={id} disabled={id === "milk" ? itemDisabled : undefined} onClick={onRowClick}>
            {id}
          </SortableItem>
        ))}
      </SortableList>,
    );
    return { onRowClick };
  }

  it("keeps every row in place, unfocusable for the drag and still clickable, when the list is disabled", async () => {
    const { onRowClick } = renderDisabled({ listDisabled: true });
    const row = getRow("milk");

    expect(screen.getByRole("list", { name: "Day" }).hasAttribute("data-disabled")).toBe(true);
    expect(row.hasAttribute("data-disabled")).toBe(true);
    expect(row.hasAttribute("tabindex")).toBe(false);
    expect(row.hasAttribute("aria-roledescription")).toBe(false);
    await pressKey(row, "Space");
    expect(row.hasAttribute("data-dragging")).toBe(false);
    fireEvent.click(row);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("disables one row while the others still lift", async () => {
    renderDisabled({ itemDisabled: true });

    await pressKey(getRow("milk"), "Space");
    expect(getRow("milk").hasAttribute("data-dragging")).toBe(false);
    await pressKey(getRow("bread"), "Space");
    expect(getRow("bread").hasAttribute("data-dragging")).toBe(true);
  });

  it("lets a row's own disabled win over the list's", async () => {
    renderDisabled({ listDisabled: true, itemDisabled: false });

    await pressKey(getRow("milk"), "Space");
    expect(getRow("milk").hasAttribute("data-dragging")).toBe(true);
  });

  it("disables the handle of a disabled row", () => {
    render(
      <SortableList label="List" items={["a"]} onReorder={vi.fn()} dragBy="handle" disabled>
        <SortableItem id="a">
          <SortableHandle />a
        </SortableItem>
      </SortableList>,
    );
    const handle = screen.getByRole("button", { name: notionMessages.en.sortable.handle });

    expect(handle.hasAttribute("disabled")).toBe(true);
    expect(handle.hasAttribute("aria-roledescription")).toBe(false);
  });
});

describe("SortableList groups", () => {
  const GROUPED = [
    { id: "stop-1", group: "stops" },
    { id: "stop-2", group: "stops" },
    { id: "fit-1", group: "fit" },
    { id: "fit-2", group: "fit" },
  ];

  function renderGrouped(onReorder = vi.fn()) {
    render(
      <SortableList label="Day" items={GROUPED.map((row) => row.id)} onReorder={onReorder}>
        {GROUPED.map((row) => (
          <SortableItem key={row.id} id={row.id} group={row.group}>
            {row.id}
          </SortableItem>
        ))}
      </SortableList>,
    );
    return onReorder;
  }

  it("moves a row within its own group", async () => {
    const onReorder = renderGrouped();
    const row = getRow("fit-1");

    expect(row.dataset["group"]).toBe("fit");
    await pressKey(row, "Space");
    await pressKey(row, "ArrowDown");
    await pressKey(row, "Space");

    expect(onReorder).toHaveBeenCalledWith(["stop-1", "stop-2", "fit-2", "fit-1"], { id: "fit-1", from: 2, to: 3 });
  });

  it("never lands a row among another group's rows", async () => {
    const onDragEnd = vi.fn();
    const onReorder = vi.fn();
    render(
      <SortableList label="Day" items={GROUPED.map((row) => row.id)} onReorder={onReorder} onDragEnd={onDragEnd}>
        {GROUPED.map((row) => (
          <SortableItem key={row.id} id={row.id} group={row.group}>
            {row.id}
          </SortableItem>
        ))}
      </SortableList>,
    );
    const row = getRow("stop-2");

    await pressKey(row, "Space");
    await pressKey(row, "ArrowDown");
    await pressKey(row, "ArrowDown");
    await pressKey(row, "Space");

    expect(onReorder).not.toHaveBeenCalled();
    expect(onDragEnd).toHaveBeenCalledWith("stop-2", null);
  });
});

describe("SortableList drag callbacks", () => {
  function renderWithCallbacks() {
    const callbacks = { onReorder: vi.fn(), onDragStart: vi.fn(), onDragEnd: vi.fn(), onDragCancel: vi.fn() };
    render(
      <SortableList label="List" items={ITEMS} {...callbacks}>
        {ITEMS.map((id) => (
          <SortableItem key={id} id={id}>
            {id}
          </SortableItem>
        ))}
      </SortableList>,
    );
    return callbacks;
  }

  it("reports the lift and marks the list as sorting until the drop", async () => {
    const { onDragStart } = renderWithCallbacks();
    const list = screen.getByRole("list", { name: "List" });

    expect(list.hasAttribute("data-sorting")).toBe(false);
    await pressKey(getRow("bread"), "Space");
    expect(onDragStart).toHaveBeenCalledWith("bread");
    expect(list.hasAttribute("data-sorting")).toBe(true);
    await pressKey(getRow("bread"), "Space");
    expect(list.hasAttribute("data-sorting")).toBe(false);
  });

  it("reports a drop that changes the order with its move", async () => {
    const { onDragEnd, onReorder } = renderWithCallbacks();
    const row = getRow("milk");

    await pressKey(row, "Space");
    await pressKey(row, "ArrowDown");
    await pressKey(row, "Space");

    expect(onDragEnd).toHaveBeenCalledWith("milk", { id: "milk", from: 0, to: 1 });
    expect(onReorder).toHaveBeenCalledTimes(1);
  });

  it("reports a drop in the row's own place with no move", async () => {
    const { onDragEnd, onReorder } = renderWithCallbacks();
    const row = getRow("milk");

    await pressKey(row, "Space");
    await pressKey(row, "Space");

    expect(onDragEnd).toHaveBeenCalledWith("milk", null);
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("reports a cancelled drag and no drop", async () => {
    const { onDragCancel, onDragEnd } = renderWithCallbacks();
    const row = getRow("eggs");

    await pressKey(row, "Space");
    await pressKey(row, "Escape");

    expect(onDragCancel).toHaveBeenCalledWith("eggs");
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(screen.getByRole("list", { name: "List" }).hasAttribute("data-sorting")).toBe(false);
  });
});

describe("SortableList activator", () => {
  function renderWithActivator(dragBy: SortableDragBy = "activator") {
    const onToggle = vi.fn();
    const onRowClick = vi.fn();
    render(
      <SortableList label="Day" items={ITEMS} onReorder={vi.fn()} dragBy={dragBy} holdDelay={10}>
        {ITEMS.map((id) => (
          <SortableItem key={id} id={id} onClick={onRowClick}>
            <SortableActivator>
              <button type="button" onClick={onToggle}>
                {id}
              </button>
            </SortableActivator>
            <p data-testid={`details-${id}`}>Details of {id}</p>
          </SortableItem>
        ))}
      </SortableList>,
    );
    return { onToggle, onRowClick };
  }

  it("lifts the row from a hold on the activator", async () => {
    renderWithActivator();
    const activator = screen.getByRole("button", { name: "milk" });

    expect(activator.dataset["slot"]).toBe("sortable-activator");
    await holdMouse(activator);
    expect(getRow("milk").hasAttribute("data-dragging")).toBe(true);
    await releaseMouse();
    await waitForClickGrace();
  });

  it("leaves the row in place on a hold elsewhere in it", async () => {
    renderWithActivator();

    await holdMouse(screen.getByTestId("details-milk"));
    expect(getRow("milk").hasAttribute("data-dragging")).toBe(false);
    await releaseMouse();
  });

  it("keeps the activator's own click and the keyboard pick-up on the row", async () => {
    const { onToggle } = renderWithActivator();
    const activator = screen.getByRole("button", { name: "milk" });

    fireEvent.click(activator);
    expect(onToggle).toHaveBeenCalledTimes(1);
    await pressKey(activator, "Enter");
    expect(getRow("milk").hasAttribute("data-dragging")).toBe(false);
    expect(getRow("milk").tabIndex).toBe(0);
    await pressKey(getRow("milk"), "Space");
    expect(getRow("milk").hasAttribute("data-dragging")).toBe(true);
  });

  it("renders its child unchanged outside activator mode", async () => {
    renderWithActivator("handle");

    await holdMouse(screen.getByRole("button", { name: "milk" }));
    expect(getRow("milk").hasAttribute("data-dragging")).toBe(false);
    await releaseMouse();
  });

  it("keeps a key pressed on a control inside a row with that control in row mode", async () => {
    renderWithActivator("row");

    await pressKey(screen.getByRole("button", { name: "milk" }), "Enter");
    expect(getRow("milk").hasAttribute("data-dragging")).toBe(false);
  });

  it("does not pass the click that ends a mouse drop to the row", async () => {
    const { onRowClick } = renderWithActivator("row");
    const row = getRow("milk");

    await holdMouse(row);
    expect(row.hasAttribute("data-dragging")).toBe(true);
    await releaseMouse();
    fireEvent.click(row);
    expect(onRowClick).not.toHaveBeenCalled();

    await waitForClickGrace();
    fireEvent.click(row);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });
});

describe("SortableList as an ordered list", () => {
  it("renders an ol that also holds a row which does not sort", async () => {
    const onReorder = vi.fn();
    render(
      <SortableList label="Stops" items={ITEMS} onReorder={onReorder} as="ol">
        {ITEMS.map((id) => (
          <SortableItem key={id} id={id}>
            {id}
          </SortableItem>
        ))}
        <li data-testid="note">Nothing else to fit in</li>
      </SortableList>,
    );
    const list = screen.getByRole("list", { name: "Stops" });
    const row = getRow("milk");

    expect(list.tagName).toBe("OL");
    expect(list.lastElementChild).toBe(screen.getByTestId("note"));
    await pressKey(row, "Space");
    await pressKey(row, "ArrowDown");
    await pressKey(row, "Space");
    expect(onReorder).toHaveBeenCalledWith(["bread", "milk", "eggs"], { id: "milk", from: 0, to: 1 });
  });
});
