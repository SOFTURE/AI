// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { House } from "lucide-react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { Sheet, SheetClose, SheetContent, SheetMenu, SheetMenuButton, SheetMenuItem, SheetTitle } from "../../src/index.js";
import { installDomShims } from "../gallery/dom.js";

beforeAll(installDomShims);
afterEach(cleanup);

function classesOf(element: Element | null): string[] {
  return (element?.getAttribute("class") ?? "").split(" ");
}

describe("SheetMenu", () => {
  it("renders a list of rows without a SidebarProvider", () => {
    render(
      <SheetMenu>
        <SheetMenuItem>
          <SheetMenuButton>
            <House aria-hidden="true" />
            <span>Home</span>
          </SheetMenuButton>
        </SheetMenuItem>
        <SheetMenuItem>
          <SheetMenuButton>Settings</SheetMenuButton>
        </SheetMenuItem>
      </SheetMenu>,
    );

    const list = screen.getByRole("list");
    expect([list.tagName, list.dataset["slot"]]).toEqual(["UL", "sheet-menu"]);
    expect(screen.getAllByRole("listitem").map((item) => item.dataset["slot"])).toEqual(["sheet-menu-item", "sheet-menu-item"]);
    expect(screen.getAllByRole("button").map((button) => button.getAttribute("type"))).toEqual(["button", "button"]);
  });

  it("is a touch target on a phone and a list row from md, in the foreground colour", () => {
    render(<SheetMenuButton>Home</SheetMenuButton>);

    expect(classesOf(screen.getByRole("button"))).toEqual(
      expect.arrayContaining(["w-full", "min-h-touch-target", "md:min-h-row-height", "text-left", "text-ui", "text-foreground", "hover:bg-accent", "focus-visible:ring-2"]),
    );
  });

  it("marks the active row", () => {
    render(
      <>
        <SheetMenuButton isActive>Home</SheetMenuButton>
        <SheetMenuButton>Settings</SheetMenuButton>
      </>,
    );

    expect(screen.getAllByRole("button").map((button) => button.dataset["active"])).toEqual(["true", "false"]);
  });

  it("dims a disabled row and ignores its clicks", () => {
    const onClick = vi.fn();
    render(
      <SheetMenuButton disabled onClick={onClick}>
        Billing
      </SheetMenuButton>,
    );
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect([onClick.mock.calls.length, classesOf(button).includes("disabled:opacity-50")]).toEqual([0, true]);
  });

  it("renders a link through asChild with the caller's aria-current", () => {
    render(
      <SheetMenuButton asChild isActive>
        <a href="/home" aria-current="page">
          Home
        </a>
      </SheetMenuButton>,
    );
    const link = screen.getByRole("link", { name: "Home" });

    expect([link.dataset["slot"], link.dataset["active"], link.getAttribute("aria-current"), link.hasAttribute("type")]).toEqual(["sheet-menu-button", "true", "page", false]);
  });

  it("closes the sheet when wrapped in SheetClose", async () => {
    const onOpenChange = vi.fn();
    render(
      <Sheet defaultOpen onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetTitle>Menu</SheetTitle>
          <SheetMenu>
            <SheetMenuItem>
              <SheetClose asChild>
                <SheetMenuButton>Home</SheetMenuButton>
              </SheetClose>
            </SheetMenuItem>
          </SheetMenu>
        </SheetContent>
      </Sheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Home" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
