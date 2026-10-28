// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { PageFrame, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetDescription, SheetTitle } from "../../src/index.js";
import { installDomShims } from "../gallery/dom.js";

beforeAll(installDomShims);
afterEach(cleanup);

const INSET = {
  top: "pt-[env(safe-area-inset-top)]",
  right: "pr-[env(safe-area-inset-right)]",
  bottom: "pb-[env(safe-area-inset-bottom)]",
  left: "pl-[env(safe-area-inset-left)]",
} as const;
const CLOSE_TOP = "top-[calc(--spacing(4)+env(safe-area-inset-top))]";
const CLOSE_RIGHT = "right-[calc(--spacing(4)+env(safe-area-inset-right))]";

function classesOf(element: Element | null): string[] {
  return (element?.getAttribute("class") ?? "").split(" ");
}

function renderSheet(side: "top" | "right" | "bottom" | "left") {
  render(
    <Sheet defaultOpen>
      <SheetContent side={side}>
        <SheetTitle>Filters</SheetTitle>
        <SheetDescription>Narrow the list.</SheetDescription>
      </SheetContent>
    </Sheet>,
  );
  const sheet = screen.getByRole("dialog", { name: "Filters" });
  return { sheet: classesOf(sheet), close: classesOf(screen.getByRole("button", { name: "Close" })) };
}

describe("SheetContent pads by the safe-area insets of the screen edges it touches", () => {
  it.each([
    { side: "right", padded: ["top", "right", "bottom"], free: "left" },
    { side: "left", padded: ["top", "left", "bottom"], free: "right" },
    { side: "top", padded: ["top", "left", "right"], free: "bottom" },
    { side: "bottom", padded: ["bottom", "left", "right"], free: "top" },
  ] as const)("$side: the $padded insets, not the $free one", ({ side, padded, free }) => {
    const { sheet } = renderSheet(side);

    expect(sheet).toEqual(expect.arrayContaining(padded.map((edge) => INSET[edge])));
    expect(sheet).not.toContain(INSET[free]);
  });

  it.each(["right", "top"] as const)("%s: the close button clears the top and right insets", (side) => {
    const { close } = renderSheet(side);

    expect(close).toEqual(expect.arrayContaining([CLOSE_TOP, CLOSE_RIGHT]));
    expect(close).not.toContain("top-4");
    expect(close).not.toContain("right-4");
  });

  it("left: the close button clears the top inset and keeps 16 px from the sheet's inner edge", () => {
    const { close } = renderSheet("left");

    expect(close).toEqual(expect.arrayContaining([CLOSE_TOP, "right-4"]));
    expect(close).not.toContain(CLOSE_RIGHT);
  });

  it("bottom: the close button keeps 16 px from the sheet's top and clears the right inset", () => {
    const { close } = renderSheet("bottom");

    expect(close).toEqual(expect.arrayContaining(["top-4", CLOSE_RIGHT]));
    expect(close).not.toContain(CLOSE_TOP);
  });
});

describe("SelectContent", () => {
  it("keeps its list clear of the inset on the side it opens towards", () => {
    render(
      <Select defaultValue="table" defaultOpen>
        <SelectTrigger aria-label="View">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="table">Table</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(classesOf(document.querySelector('[data-slot="select-content"]'))).toEqual(
      expect.arrayContaining([
        "data-[side=bottom]:max-h-[calc(var(--radix-select-content-available-height)-env(safe-area-inset-bottom))]",
        "data-[side=top]:max-h-[calc(var(--radix-select-content-available-height)-env(safe-area-inset-top))]",
      ]),
    );
  });
});

describe("PageFrame", () => {
  it("pads the page by all four safe-area insets", () => {
    const html = renderToStaticMarkup(<PageFrame>page</PageFrame>);

    for (const inset of Object.values(INSET)) expect(html).toContain(inset);
  });
});
