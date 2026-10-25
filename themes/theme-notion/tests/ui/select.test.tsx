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
});
