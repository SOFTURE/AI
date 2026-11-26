// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { RowActionsMenu, type RowActionsMenuProps } from "../../src/notion/RowActionsMenu.js";
import { Dialog, DialogContent, DialogTitle } from "../../src/ui/dialog.js";
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

interface Deferred {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
}

function createDeferred(): Deferred {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function renderAsyncDelete(deferred: Deferred) {
  const onDelete = vi.fn(() => deferred.promise);
  renderMenu({
    destructiveAction: {
      label: "Delete",
      onSelect: onDelete,
      confirm: { title: "Delete this connection?", confirmLabel: "Delete", pendingLabel: "Deleting…", cancelLabel: "Keep" },
    },
  });
  openWithKeyboard();
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
  return onDelete;
}

describe("RowActionsMenu: an async destructive action (#1492)", () => {
  it("keeps the confirmation open, disabled and pending until the promise resolves", async () => {
    const deferred = createDeferred();
    const onDelete = renderAsyncDelete(deferred);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledOnce();
    const confirm = await screen.findByRole("button", { name: "Deleting…" });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(confirm.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Keep" }).disabled).toBe(true);

    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("stays open and enabled again when the promise rejects", async () => {
    const deferred = createDeferred();
    renderAsyncDelete(deferred);
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await screen.findByRole("button", { name: "Deleting…" });

    await act(async () => {
      deferred.reject(new Error("delete failed"));
      await deferred.promise.catch(() => undefined);
    });

    const confirm = await screen.findByRole("button", { name: "Delete" });
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Keep" }).disabled).toBe(false);
  });
});

function MenuWithAppDialog({ triggerRef }: { readonly triggerRef?: React.Ref<HTMLButtonElement> }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <RowActionsMenu
        triggerRef={triggerRef}
        actions={[{ id: "replace-token", label: "Replace token", onSelect: () => setIsOpen(true), opensDialog: true }]}
      />
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogTitle>Replace the token</DialogTitle>
          <input aria-label="Token" />
        </DialogContent>
      </Dialog>
    </>
  );
}

describe("RowActionsMenu: an action that opens the app's dialog (#1492)", () => {
  it("leaves focus to the app's dialog when the menu closes", async () => {
    render(<MenuWithAppDialog />);
    openWithKeyboard();
    fireEvent.click(screen.getByRole("menuitem", { name: "Replace token" }));

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("does not take focus back to its button after an opensDialog item, but does after any other", async () => {
    renderMenu({
      actions: [
        { label: "Replace token", onSelect: vi.fn(), opensDialog: true },
        { label: "Test", onSelect: vi.fn() },
      ],
      destructiveAction: undefined,
    });
    const trigger = screen.getByRole("button", { name: "More actions" });
    openWithKeyboard();
    fireEvent.click(screen.getByRole("menuitem", { name: "Replace token" }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).not.toBe(trigger);

    openWithKeyboard();
    fireEvent.click(screen.getByRole("menuitem", { name: "Test" }));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("hands the menu button to the app through triggerRef", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    render(<MenuWithAppDialog triggerRef={triggerRef} />);

    expect(triggerRef.current).toBe(screen.getByRole("button", { name: "More actions" }));
  });
});

describe("RowActionsMenu: touch items and test hooks (#1492)", () => {
  it("makes every item the touch target below md and marks it with data-row-action", () => {
    renderMenu({
      actions: [{ id: "test", label: "Test", onSelect: vi.fn() }],
      destructiveAction: { id: "delete", label: "Delete", onSelect: vi.fn() },
    });
    openWithKeyboard();
    const items = screen.getAllByRole("menuitem");

    expect(items.map((item) => item.getAttribute("data-row-action"))).toEqual(["test", "delete"]);
    for (const item of items) expect(item.className.split(" ")).toContain("max-md:min-h-touch-target");
  });
});

describe("RowActionsMenu: touch confirmation buttons (#1502)", () => {
  it("makes the confirmation's Cancel and confirm buttons the touch target below md and keeps them compact above", async () => {
    renderMenu();
    openWithKeyboard();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    const buttons = [
      within(dialog).getByRole("button", { name: "Keep" }),
      within(dialog).getByRole("button", { name: "Delete" }),
    ];

    for (const button of buttons) {
      const classes = button.className.split(" ");
      expect(classes).toContain("max-md:h-touch-target");
      expect(classes).toContain("h-7");
    }
  });
});
