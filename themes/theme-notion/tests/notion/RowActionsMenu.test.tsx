// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { RowActionsMenu, type RowActionsMenuProps } from "../../src/notion/RowActionsMenu.js";
import { installDomShims } from "../gallery/dom.js";

beforeAll(installDomShims);
afterEach(cleanup);

function renderMenu(props: Partial<RowActionsMenuProps> = {}) {
  const onTest = vi.fn();
  const onReplace = vi.fn();
  const onDelete = vi.fn();
  render(
    <RowActionsMenu
      actions={[
        { label: "Test", onSelect: onTest },
        { label: "Replace token", onSelect: onReplace },
      ]}
      destructiveAction={{
        label: "Delete",
        onSelect: onDelete,
        confirm: {
          title: "Delete this connection?",
          description: "The app stops sending events.",
          confirmLabel: "Delete",
          cancelLabel: "Keep",
        },
      }}
      {...props}
    />,
  );
  return { onTest, onReplace, onDelete };
}

function openWithKeyboard(): HTMLElement {
  const trigger = screen.getByRole("button", { name: "More actions" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
  return screen.getByRole("menu");
}

describe("RowActionsMenu (#1486)", () => {
  it("is an icon-only button named More actions that opens a menu", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "More actions" });

    expect(trigger.getAttribute("data-slot")).toBe("row-actions-menu-trigger");
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.textContent).toBe("");
    expect(trigger.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("takes the app's own name for the button", () => {
    renderMenu({ label: "Row options" });

    expect(screen.getByRole("button", { name: "Row options" })).toBeTruthy();
  });

  it("opens with the keyboard and moves between items with the arrow keys", async () => {
    renderMenu();
    openWithKeyboard();
    const items = screen.getAllByRole("menuitem");

    expect(items.map((item) => item.textContent)).toEqual(["Test", "Replace token", "Delete"]);
    await waitFor(() => expect(document.activeElement).toBe(items[0]));
    fireEvent.keyDown(items[0] as HTMLElement, { key: "ArrowDown" });
    await waitFor(() => expect(document.activeElement).toBe(items[1]));
  });

  it("runs an item's action and closes", () => {
    const { onReplace } = renderMenu();
    openWithKeyboard();
    fireEvent.click(screen.getByRole("menuitem", { name: "Replace token" }));

    expect(onReplace).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("puts the destructive item last, after a separator, in the danger tone", () => {
    renderMenu();
    const menu = openWithKeyboard();
    const children = Array.from(menu.children);
    const last = children.at(-1);

    expect(last?.getAttribute("data-variant")).toBe("destructive");
    expect(last?.textContent).toBe("Delete");
    expect(children.at(-2)?.getAttribute("data-slot")).toBe("dropdown-menu-separator");
  });

  it("asks for confirmation before a destructive action and runs it only on confirm", async () => {
    const { onDelete } = renderMenu();
    openWithKeyboard();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Delete this connection?");
    expect(dialog.textContent).toContain("The app stops sending events.");
    expect(onDelete).not.toHaveBeenCalled();

    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm.getAttribute("data-variant")).toBe("destructive");
    fireEvent.click(confirm);

    expect(onDelete).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("does nothing when the confirmation is cancelled", async () => {
    const { onDelete } = renderMenu();
    openWithKeyboard();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    fireEvent.click(await screen.findByRole("button", { name: "Keep" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("runs a destructive action at once when it asks for no confirmation", () => {
    const onArchive = vi.fn();
    renderMenu({ destructiveAction: { label: "Archive", onSelect: onArchive } });
    openWithKeyboard();
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));

    expect(onArchive).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("draws no separator without secondary actions, and disables an item when asked", () => {
    renderMenu({ actions: [{ label: "Test", onSelect: vi.fn(), isDisabled: true }], destructiveAction: undefined });
    const menu = openWithKeyboard();

    expect(menu.querySelector('[data-slot="dropdown-menu-separator"]')).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Test" }).getAttribute("data-disabled")).toBe("");
  });
});
