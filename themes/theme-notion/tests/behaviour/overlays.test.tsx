// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectScrollUpButton,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "../../src/index.js";
import { installDomShims } from "../gallery/dom.js";

beforeAll(installDomShims);
afterEach(cleanup);

function classesOf(element: Element | null): string[] {
  return (element?.getAttribute("class") ?? "").split(" ");
}

/** Opens a Radix trigger the way a pointer does (Radix menus and selects open on pointerdown). */
function pointerDown(element: Element): void {
  fireEvent.pointerDown(element, { button: 0, ctrlKey: false, pointerType: "mouse" });
}

describe("Dialog", () => {
  function renderDialog(closeLabel?: string) {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Share</Button>
        </DialogTrigger>
        <DialogContent closeLabel={closeLabel}>
          <DialogTitle>Share the page</DialogTitle>
          <DialogDescription>Anyone with the link can view it.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
  }

  it("opens from its trigger, closes on Escape and returns focus to the trigger", async () => {
    renderDialog();
    const trigger = screen.getByRole("button", { name: "Share" });
    trigger.focus();

    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Share the page" });
    expect(classesOf(dialog)).toEqual(expect.arrayContaining(["rounded-xl", "shadow-dialog"]));

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("closes from its close button, named by closeLabel or in English", () => {
    renderDialog("Done");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    cleanup();
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByRole("button", { name: "Close" }).dataset["slot"]).toBe("dialog-close");
  });
});

describe("Sheet", () => {
  it("opens, names its close button by closeLabel and closes on Escape", () => {
    render(
      <Sheet>
        <SheetTrigger>Settings</SheetTrigger>
        <SheetContent side="left" closeLabel="Hide">
          <SheetTitle>Page settings</SheetTitle>
          <SheetDescription>Layout and sharing.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const sheet = screen.getByRole("dialog", { name: "Page settings" });
    expect(screen.getByRole("button", { name: "Hide" })).toBeTruthy();
    expect(classesOf(sheet)).toEqual(expect.arrayContaining(["inset-y-0", "left-0"]));

    fireEvent.keyDown(sheet, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names its close button in English by default", () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetTitle>Page settings</SheetTitle>
          <SheetDescription>Layout.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });
});

describe("AlertDialog", () => {
  it("closes from Cancel and from the action, and on Escape", () => {
    const onAction = vi.fn();
    render(
      <AlertDialog>
        <AlertDialogTrigger>Delete</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Delete the page?</AlertDialogTitle>
          <AlertDialogDescription>It moves to the trash.</AlertDialogDescription>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onAction}>Delete for good</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    );
    const open = () => fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();

    open();
    fireEvent.click(screen.getByRole("button", { name: "Delete for good" }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).toBeNull();

    open();
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("Select", () => {
  function renderSelect(onValueChange = vi.fn()) {
    render(
      <Select defaultValue="table" onValueChange={onValueChange}>
        <SelectTrigger aria-label="View">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectScrollUpButton />
          <SelectItem value="table">Table</SelectItem>
          <SelectItem value="board">Board</SelectItem>
        </SelectContent>
      </Select>,
    );
    return onValueChange;
  }

  it("opens from its trigger and chooses an option", () => {
    const onValueChange = renderSelect();
    const trigger = screen.getByRole("combobox", { name: "View" });

    pointerDown(trigger);
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "Board" }));

    expect(onValueChange).toHaveBeenCalledWith("board");
    expect(trigger.textContent).toBe("Board");
  });

  it("opens from the keyboard", () => {
    renderSelect();

    fireEvent.keyDown(screen.getByRole("combobox", { name: "View" }), { key: "Enter" });

    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  // The scroll buttons render only when the list overflows, which happy-dom cannot lay out; the upstream guard
  // (tests/upstream.test.ts) pins their classes.
  it("mutes item icons", () => {
    render(
      <Select defaultValue="table" defaultOpen>
        <SelectTrigger aria-label="View">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectScrollUpButton />
          <SelectItem value="table">Table</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(classesOf(document.querySelector('[data-slot="select-item"]'))).toContain("[&_svg:not([class*='text-'])]:text-muted-foreground");
  });
});

describe("DropdownMenu", () => {
  it("opens from its trigger, runs an item and closes", () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Options</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>Duplicate</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    pointerDown(screen.getByRole("button", { name: "Options" }));
    const menu = screen.getByRole("menu");
    expect(classesOf(menu)).toEqual(expect.arrayContaining(["rounded-xl", "shadow-menu"]));
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("Command", () => {
  it("filters items by the typed text and shows the empty state", () => {
    render(
      <Command>
        <CommandInput aria-label="Search" />
        <CommandList>
          <CommandEmpty>No pages.</CommandEmpty>
          <CommandItem>Roadmap</CommandItem>
          <CommandItem>Calendar</CommandItem>
        </CommandList>
      </Command>,
    );
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "road" } });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Roadmap"]);

    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.queryAllByRole("option")).toEqual([]);
    expect(screen.getByText("No pages.")).toBeTruthy();
  });

  it("chooses an item with Enter", () => {
    const onSelect = vi.fn();
    render(
      <Command>
        <CommandInput aria-label="Search" />
        <CommandList>
          <CommandItem onSelect={onSelect}>Roadmap</CommandItem>
        </CommandList>
      </Command>,
    );

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("Roadmap");
  });

  it("titles its dialog by props or in English", () => {
    render(
      <CommandDialog open title="Jump to" description="Find a page.">
        <CommandInput />
      </CommandDialog>,
    );
    expect(screen.getByRole("dialog", { name: "Jump to" })).toBeTruthy();
    expect(screen.getByText("Find a page.")).toBeTruthy();

    cleanup();
    render(
      <CommandDialog open showCloseButton={false}>
        <CommandInput />
      </CommandDialog>,
    );
    expect(screen.getByRole("dialog", { name: "Command Palette" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});
