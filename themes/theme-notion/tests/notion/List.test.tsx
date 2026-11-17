import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIST_CLASSES, List, ListItem, ListRow } from "../../src/notion/List.js";

function readOpening(html: string, slot: string): string {
  const match = new RegExp(`<\\w+ [^>]*data-slot="${slot}"[^>]*>`).exec(html);
  if (match === null) throw new Error(`No ${slot} in ${html}`);
  return match[0];
}

function readClasses(opening: string): string[] {
  return (/class="([^"]*)"/.exec(opening)?.[1] ?? "").split(" ");
}

describe("List (#1341)", () => {
  it("is a ul whose line between rows reads the density's width, in the theme's border", () => {
    const html = renderToStaticMarkup(
      <List aria-label="Days">
        <ListItem>One</ListItem>
      </List>,
    );
    const list = readOpening(html, "list");

    expect(list.startsWith("<ul ")).toBe(true);
    expect(list).toContain('aria-label="Days"');
    expect(list).toContain('data-surface="page"');
    expect(list).not.toContain("data-density");
    expect(readClasses(list)).toEqual(["flex", "flex-col", "divide-y-(length:--list-divider-width)", "divide-border"]);
  });

  it("is an ol when asked, and on a tinted card draws its line in the page's background", () => {
    const list = readOpening(renderToStaticMarkup(<List as="ol" surface="tinted" />), "list");

    expect(list.startsWith("<ol ")).toBe(true);
    expect(list).toContain('data-surface="tinted"');
    expect(readClasses(list)).toContain("divide-background");
    expect(readClasses(list)).not.toContain("divide-border");
  });

  it("sets its own density only when given one", () => {
    expect(readOpening(renderToStaticMarkup(<List density="roomy" />), "list")).toContain('data-density="roomy"');
    expect(readOpening(renderToStaticMarkup(<List density="compact" />), "list")).toContain('data-density="compact"');
  });

  it("merges an app's class after its own", () => {
    expect(readClasses(readOpening(renderToStaticMarkup(<List className="gap-0 px-2" />), "list"))).toContain("px-2");
  });
});

describe("ListItem (#1341)", () => {
  it("is an li padded by the density's item room", () => {
    const item = readOpening(renderToStaticMarkup(<ListItem>One</ListItem>), "list-item");

    expect(item.startsWith("<li ")).toBe(true);
    expect(readClasses(item)).toEqual(["py-(--list-item-y)"]);
  });

  it("with asChild keeps the child's element and attributes and adds its classes", () => {
    const item = readOpening(
      renderToStaticMarkup(
        <ListItem asChild className="relative">
          <li data-attraction-row="a1" />
        </ListItem>,
      ),
      "list-item",
    );

    expect(item).toContain('data-attraction-row="a1"');
    expect(readClasses(item)).toEqual(["py-(--list-item-y)", "relative"]);
  });
});

describe("ListRow (#1341)", () => {
  it("is a full-width div padded by the density's row padding, with the theme's hover", () => {
    const row = readOpening(renderToStaticMarkup(<ListRow>Day</ListRow>), "list-row");

    expect(row.startsWith("<div ")).toBe(true);
    expect(readClasses(row)).toEqual(LIST_CLASSES.row.split(" "));
    expect(readClasses(row)).toContain("py-(--list-row-y)");
    expect(readClasses(row)).toContain("hover:bg-accent");
  });

  it("with asChild renders the app's button, keeping its type and handlers, and lets the app's padding win", () => {
    const html = renderToStaticMarkup(
      <ListRow asChild className="px-3">
        <button type="button" aria-pressed="true">
          Day
        </button>
      </ListRow>,
    );
    const row = readOpening(html, "list-row");

    expect(row.startsWith("<button ")).toBe(true);
    expect(row).toContain('type="button"');
    expect(row).toContain('aria-pressed="true"');
    expect(readClasses(row)).toContain("px-3");
    expect(readClasses(row)).not.toContain("px-2");
  });
});

describe("LIST_CLASSES (#1341)", () => {
  it("reads only the density variables and theme colours, no raw length or colour", () => {
    expect(LIST_CLASSES.list).toBe("flex flex-col divide-y-(length:--list-divider-width) divide-border");
    expect(LIST_CLASSES.tintedList).toBe("flex flex-col divide-y-(length:--list-divider-width) divide-background");
    expect(LIST_CLASSES.item).toBe("py-(--list-item-y)");
    expect(LIST_CLASSES.row).not.toMatch(/\[|#|\bpy-\d/);
  });
});
