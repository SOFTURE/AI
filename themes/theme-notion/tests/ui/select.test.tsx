// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Select, SelectContent, SelectItem, SelectScrollUpButton, SelectTrigger, SelectValue } from "../../src/ui/select.js";

afterEach(cleanup);

function readClasses(element: Element | null | undefined): string[] {
  return (element?.getAttribute("class") ?? "").split(/\s+/);
}

describe("Select", () => {
  it("draws the scroll-up arrow at 16 px and keeps the button's own classes on the button", () => {
    render(
      <Select open value="a">
        <SelectTrigger aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectScrollUpButton />
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );
    // Radix mounts the button only once the list is scrolled down.
    const viewport = document.querySelector("[data-radix-select-viewport]");
    if (!(viewport instanceof HTMLElement)) throw new Error("the select list has no viewport");
    act(() => {
      viewport.scrollTop = 40;
      fireEvent.scroll(viewport);
    });
    const button = document.querySelector('[data-slot="select-scroll-up-button"]');
    const icon = button?.querySelector("svg");

    expect(readClasses(button)).toEqual(expect.arrayContaining(["flex", "cursor-default", "items-center", "justify-center", "py-1"]));
    expect(readClasses(icon)).toContain("size-4");
    expect(readClasses(icon)).not.toContain("py-1");
  });

  it("mutes an item's icons and check unless they carry their own text colour", () => {
    render(
      <Select open value="a">
        <SelectTrigger aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(readClasses(screen.getByRole("option", { name: "Alpha" }))).toContain("[&_svg:not([class*='text-'])]:text-muted-foreground");
  });

  it("draws a touch trigger at 44 px with a plain class a caller's breakpoint class can override", () => {
    render(
      <Select value="a">
        <SelectTrigger aria-label="Status" size="touch" className="md:h-7">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "Status" });

    expect(trigger.getAttribute("data-size")).toBe("touch");
    expect(readClasses(trigger)).toEqual(expect.arrayContaining(["h-touch-target", "md:h-7"]));
  });

  it("keeps the 28 px trigger and items by default", () => {
    render(
      <Select open value="a">
        <SelectTrigger aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );

    // The open list hides the trigger from the accessibility tree.
    expect(readClasses(document.querySelector('[data-slot="select-trigger"]'))).not.toContain("h-touch-target");
    expect(readClasses(screen.getByRole("option", { name: "Alpha" }))).toContain("min-h-7");
    expect(readClasses(screen.getByRole("option", { name: "Alpha" }))).not.toContain("min-h-touch-target");
  });

  it("raises every item of a touch list to 44 px, and an item's own size wins over the list's", () => {
    render(
      <Select open value="a">
        <SelectTrigger aria-label="Status" size="touch">
          <SelectValue />
        </SelectTrigger>
        <SelectContent size="touch" position="popper">
          <SelectItem value="a">Alpha</SelectItem>
          <SelectItem value="b" size="default">Beta</SelectItem>
        </SelectContent>
      </Select>,
    );
    const alpha = readClasses(screen.getByRole("option", { name: "Alpha" }));
    const beta = readClasses(screen.getByRole("option", { name: "Beta" }));

    expect(alpha).toContain("min-h-touch-target");
    expect(alpha).not.toContain("min-h-7");
    expect(beta).toContain("min-h-7");
    expect(beta).not.toContain("min-h-touch-target");
  });

  it("raises a single item with its own touch size", () => {
    render(
      <Select open value="a">
        <SelectTrigger aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a" size="touch" className="md:min-h-7">Alpha</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(readClasses(screen.getByRole("option", { name: "Alpha" }))).toEqual(expect.arrayContaining(["min-h-touch-target", "md:min-h-7"]));
  });
});
