// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../src/ui/dropdown-menu.js";

afterEach(cleanup);

function readClasses(element: Element | null | undefined): string[] {
  return (element?.getAttribute("class") ?? "").split(/\s+/);
}

function renderMenu(contentSize?: "default" | "touch", itemSize?: "default" | "touch") {
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent {...(contentSize === undefined ? {} : { size: contentSize })}>
        <DropdownMenuItem>Rename</DropdownMenuItem>
        <DropdownMenuItem {...(itemSize === undefined ? {} : { size: itemSize })}>Delete</DropdownMenuItem>
        <DropdownMenuCheckboxItem checked>Pinned</DropdownMenuCheckboxItem>
        <DropdownMenuRadioGroup value="table">
          <DropdownMenuRadioItem value="table">Table</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

function readItemClasses(): Record<string, string[]> {
  return {
    rename: readClasses(screen.getByRole("menuitem", { name: "Rename" })),
    delete: readClasses(screen.getByRole("menuitem", { name: "Delete" })),
    pinned: readClasses(screen.getByRole("menuitemcheckbox", { name: "Pinned" })),
    table: readClasses(screen.getByRole("menuitemradio", { name: "Table" })),
    moveTo: readClasses(screen.getByRole("menuitem", { name: "Move to" })),
  };
}

describe("DropdownMenu", () => {
  it("keeps every item 28 px high by default", () => {
    renderMenu();

    for (const classes of Object.values(readItemClasses())) {
      expect(classes).toContain("min-h-7");
      expect(classes).not.toContain("min-h-touch-target");
    }
  });

  it("raises every item of a touch menu to 44 px, the checkbox, radio and sub-menu rows too", () => {
    renderMenu("touch");

    for (const classes of Object.values(readItemClasses())) {
      expect(classes).toContain("min-h-touch-target");
      expect(classes).not.toContain("min-h-7");
    }
  });

  it("lets an item's own size win over its menu's", () => {
    renderMenu("touch", "default");
    const items = readItemClasses();

    expect(items["delete"]).toContain("min-h-7");
    expect(items["delete"]).not.toContain("min-h-touch-target");
    expect(items["rename"]).toContain("min-h-touch-target");
  });

  it("raises a single item with its own touch size and keeps a caller's breakpoint class", () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem size="touch" className="md:min-h-7">Rename</DropdownMenuItem>
          <DropdownMenuCheckboxItem size="touch">Pinned</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    expect(readClasses(screen.getByRole("menuitem", { name: "Rename" }))).toEqual(expect.arrayContaining(["min-h-touch-target", "md:min-h-7"]));
    expect(readClasses(screen.getByRole("menuitemcheckbox", { name: "Pinned" }))).toContain("min-h-touch-target");
  });
});
