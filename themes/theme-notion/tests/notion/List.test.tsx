import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  LIST_CLASSES,
  List,
  ListEntry,
  ListGroup,
  ListGroupHeading,
  ListItem,
  ListRow,
  type ListEntryProps,
} from "../../src/notion/List.js";

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

describe("ListGroup (#1350)", () => {
  it("is a div that holds the side room its heading bleeds over and stops every item below the heading", () => {
    const html = renderToStaticMarkup(
      <ListGroup aria-labelledby="france">
        <ListGroupHeading id="france">France</ListGroupHeading>
        <List>
          <ListItem>Mon 3 March</ListItem>
        </List>
      </ListGroup>,
    );
    const group = readOpening(html, "list-group");

    expect(group.startsWith("<div ")).toBe(true);
    expect(group).toContain('aria-labelledby="france"');
    expect(readClasses(group)).toEqual(["px-2", "**:data-[slot=list-item]:scroll-mt-10"]);
    expect(html.indexOf('data-slot="list-group-heading"')).toBeLessThan(html.indexOf('data-slot="list"'));
  });

  it("with asChild keeps the app's element and lets the app's side room win", () => {
    const group = readOpening(
      renderToStaticMarkup(
        <ListGroup asChild className="px-3">
          <section />
        </ListGroup>,
      ),
      "list-group",
    );

    expect(group.startsWith("<section ")).toBe(true);
    expect(readClasses(group)).toContain("px-3");
    expect(readClasses(group)).not.toContain("px-2");
  });
});

describe("ListGroupHeading (#1350)", () => {
  it("sticks at the top of the scroll, spans the scrollport over the group's side room, on the page with a line under it", () => {
    const heading = readOpening(renderToStaticMarkup(<ListGroupHeading>France</ListGroupHeading>), "list-group-heading");
    const classes = readClasses(heading);

    expect(heading.startsWith("<div ")).toBe(true);
    expect(heading).toContain('data-surface="page"');
    for (const name of ["sticky", "top-0", "z-10", "-mx-2", "px-4", "min-h-10", "bg-background", "border-b", "border-border", "text-ui-medium", "text-foreground"]) {
      expect(classes).toContain(name);
    }
  });

  it("on a tinted card takes the card's secondary and draws its line in the page's background", () => {
    const heading = readOpening(renderToStaticMarkup(<ListGroupHeading surface="tinted">France</ListGroupHeading>), "list-group-heading");

    expect(heading).toContain('data-surface="tinted"');
    expect(readClasses(heading)).toContain("bg-secondary");
    expect(readClasses(heading)).toContain("border-background");
    expect(readClasses(heading)).not.toContain("bg-background");
  });

  it("with asChild renders the app's heading element", () => {
    const heading = readOpening(
      renderToStaticMarkup(
        <ListGroupHeading asChild>
          <h3 id="france">France</h3>
        </ListGroupHeading>,
      ),
      "list-group-heading",
    );

    expect(heading.startsWith("<h3 ")).toBe(true);
    expect(heading).toContain('id="france"');
  });

  it("is exactly as tall as the scroll margin it leaves above each item (min-h-10, scroll-mt-10)", () => {
    expect(LIST_CLASSES.groupHeading).toContain("min-h-10");
    expect(LIST_CLASSES.tintedGroupHeading).toContain("min-h-10");
    expect(LIST_CLASSES.group).toContain("scroll-mt-10");
    expect(`${LIST_CLASSES.group} ${LIST_CLASSES.groupHeading} ${LIST_CLASSES.tintedGroupHeading}`).not.toMatch(/#|\[\d/);
  });
});

describe("ListEntry (#1481)", () => {
  const renderEntry = (props: Partial<ListEntryProps> = {}) =>
    renderToStaticMarkup(
      <ListEntry
        title="Nightly deploy"
        details={<span>main · 4 min ago</span>}
        status={<span data-testid="state">Passed</span>}
        actions={<button type="button">Retry</button>}
        {...props}
      />,
    );

  it("lays the identity on the left and the right column (status over actions) on the right", () => {
    const html = renderEntry();
    const entry = readOpening(html, "list-entry");

    expect(entry.startsWith("<div ")).toBe(true);
    expect(readClasses(entry)).toEqual(expect.arrayContaining(["relative", "flex", "flex-wrap", "items-start", "hover:bg-accent", "py-(--list-row-y)"]));
    expect(readClasses(readOpening(html, "list-entry-identity"))).toEqual(expect.arrayContaining(["min-w-0", "flex-1", "max-md:basis-full"]));
    expect(html.indexOf('data-slot="list-entry-title"')).toBeLessThan(html.indexOf('data-slot="list-entry-details"'));
    expect(html.indexOf('data-slot="list-entry-status"')).toBeLessThan(html.indexOf('data-slot="list-entry-actions"'));
    expect(readClasses(readOpening(html, "list-entry-column"))).toEqual(expect.arrayContaining(["flex-col", "items-end"]));
    expect(readClasses(readOpening(html, "list-entry-side"))).toEqual(expect.arrayContaining(["ml-auto", "relative", "z-10"]));
  });

  it("aligns the identity and the right column to the top, so the state stands on the title's line (#1497)", () => {
    const html = renderEntry({ href: "/deploys/42", details: [<span key="a">main</span>, <span key="b">4 min ago</span>] });

    expect(readClasses(readOpening(html, "list-entry"))).toContain("items-start");
    expect(readClasses(readOpening(html, "list-entry"))).not.toContain("items-center");
    expect(readClasses(readOpening(html, "list-entry-side"))).toContain("items-start");
    expect(readClasses(readOpening(html, "list-entry-side"))).not.toContain("items-center");
    expect(readClasses(readOpening(html, "list-entry-arrow"))).toEqual(expect.arrayContaining(["h-5", "items-center"]));
  });

  it("centres the arrow on a one-line column and keeps it on the status's line over stacked controls (#1520)", () => {
    const sideOf = (props: Partial<ListEntryProps>) => readClasses(readOpening(renderEntry({ href: "/deploys/42", ...props }), "list-entry-side"));
    const centred = ["items-center", "has-[[data-row-wide]]:items-start"];

    expect(sideOf({ status: undefined })).toEqual(expect.arrayContaining(centred));
    expect(sideOf({ status: undefined })).not.toContain("items-start");
    expect(sideOf({ actions: undefined })).toEqual(expect.arrayContaining(centred));
    expect(sideOf({ sideLayout: "inline" })).toEqual(expect.arrayContaining(centred));
    expect(sideOf({})).toContain("items-start");
    expect(sideOf({})).not.toContain("items-center");
  });

  it("draws only the slots it is given", () => {
    const html = renderToStaticMarkup(<ListEntry title="Plain" />);

    expect(html).toContain('data-slot="list-entry-title"');
    for (const slot of ["list-entry-details", "list-entry-side", "list-entry-status", "list-entry-actions", "list-entry-arrow"]) {
      expect(html).not.toContain(`data-slot="${slot}"`);
    }
    const statusOnly = renderToStaticMarkup(<ListEntry title="Plain" status="Passed" />);
    expect(statusOnly).toContain('data-slot="list-entry-status"');
    expect(statusOnly).not.toContain('data-slot="list-entry-actions"');
  });

  it("makes the controls at least the touch target on a phone", () => {
    const actions = readClasses(readOpening(renderEntry(), "list-entry-actions"));

    expect(actions).toEqual(
      expect.arrayContaining([
        "max-md:*:not-data-[slot=switch]:min-h-touch-target",
        "max-md:*:not-data-[slot=switch]:min-w-touch-target",
        "justify-end",
      ]),
    );
  });

  it("with href, stretches the title's link over the row and keeps the arrow beside the column", () => {
    const html = renderEntry({ href: "/deploys/42" });
    const link = readOpening(html, "list-entry-title");
    const side = html.slice(html.indexOf('data-slot="list-entry-side"'));

    expect(link.startsWith("<a ")).toBe(true);
    expect(link).toContain('href="/deploys/42"');
    expect(readClasses(link)).toEqual(expect.arrayContaining(["after:absolute", "after:inset-0"]));
    expect(side).toContain('data-slot="list-entry-arrow"');
    expect(readClasses(readOpening(html, "list-entry-side"))).toContain("flex-nowrap");
    expect(readOpening(html, "list-entry-arrow")).toContain('aria-hidden="true"');
    expect(readClasses(readOpening(html, "list-entry"))).toContain("has-[[data-slot=list-entry-title]:focus-visible]:ring-2");
  });

  it("with href and no column, still draws the arrow at the row's right edge", () => {
    const html = renderToStaticMarkup(<ListEntry title="Open" href="/x" />);

    expect(html).toContain('data-slot="list-entry-side"');
    expect(html).toContain('data-slot="list-entry-arrow"');
    expect(html).not.toContain('data-slot="list-entry-column"');
  });

  it("renders the app's own link component for the title", () => {
    function AppLink(props: { readonly href: string; readonly className?: string; readonly children?: ReactNode }) {
      return <a data-app-link="" {...props} />;
    }
    const link = readOpening(renderEntry({ href: "/inbox", linkComponent: AppLink }), "list-entry-title");

    expect(link).toContain("data-app-link");
    expect(link).toContain('href="/inbox"');
  });

  it("gives a data-row-wide control the full row width, its lines starting on the left", () => {
    const html = renderEntry();

    expect(readClasses(readOpening(html, "list-entry-side"))).toEqual(
      expect.arrayContaining(["has-[[data-row-wide]]:basis-full", "has-[[data-row-wide]]:ml-0"]),
    );
    expect(readClasses(readOpening(html, "list-entry-column"))).toEqual(
      expect.arrayContaining(["has-[[data-row-wide]]:flex-1", "has-[[data-row-wide]]:items-stretch"]),
    );
    expect(readClasses(readOpening(html, "list-entry-actions"))).toEqual(
      expect.arrayContaining(["has-[[data-row-wide]]:flex-col", "has-[[data-row-wide]]:items-stretch", "has-[[data-row-wide]]:justify-start"]),
    );
    expect(readClasses(readOpening(html, "list-entry-status"))).toContain(
      "group-has-[[data-row-wide]]/list-entry-side:justify-start",
    );
  });

  it("passes the app's attributes and classes to the row", () => {
    const entry = readOpening(renderEntry({ className: "my-row", "data-run": "42" } as Partial<ListEntryProps>), "list-entry");

    expect(entry).toContain('data-run="42"');
    expect(readClasses(entry)).toContain("my-row");
  });
});

describe("ListEntry menu (#1486)", () => {
  function renderEntry(props: Partial<ListEntryProps>): string {
    return renderToStaticMarkup(<ListEntry title="Webhook" {...props} />);
  }

  it("puts the menu on the actions line, after the inline control, in a slot that never shrinks", () => {
    const html = renderEntry({
      actions: <button type="button">Switch</button>,
      menu: <button type="button">More</button>,
    });
    const actions = readOpening(html, "list-entry-actions");
    const menu = readOpening(html, "list-entry-menu");

    expect(html.indexOf("Switch")).toBeLessThan(html.indexOf('data-slot="list-entry-menu"'));
    expect(html.indexOf(actions)).toBeLessThan(html.indexOf(menu));
    expect(readClasses(actions)).toContain("flex-nowrap");
    expect(readClasses(menu)).toEqual(expect.arrayContaining(["flex", "shrink-0"]));
  });

  it("draws the column for a menu alone", () => {
    const html = renderEntry({ menu: <button type="button">More</button> });

    expect(html).toContain('data-slot="list-entry-column"');
    expect(html).toContain('data-slot="list-entry-menu"');
  });

  it("never stretches a switch on a phone, and lets a touch switch keep its square beside the menu", () => {
    const actions = readClasses(readOpening(renderEntry({ actions: <span />, menu: <span /> }), "list-entry-actions"));

    expect(actions).not.toContain("max-md:*:min-h-touch-target");
    expect(actions).toContain("max-md:*:data-[slot=switch]:mx-0");
  });

  it("keeps the actions line wrapping when there is no menu", () => {
    const html = renderEntry({ actions: <button type="button">Retry</button> });

    expect(html).not.toContain('data-slot="list-entry-menu"');
    expect(readClasses(readOpening(html, "list-entry-actions"))).toContain("flex-wrap");
  });
});

describe("ListEntry sideLayout (#1508)", () => {
  const renderEntry = (props: Partial<ListEntryProps> = {}) =>
    renderToStaticMarkup(
      <ListEntry
        title="softure/ai"
        details={<span>Watched since 3 March</span>}
        status={<span>Readable</span>}
        actions={<button type="button">Delete</button>}
        {...props}
      />,
    );

  it("stacks the status over the controls by default", () => {
    for (const html of [renderEntry(), renderEntry({ sideLayout: "stack" })]) {
      const column = readOpening(html, "list-entry-column");

      expect(column).toContain('data-side-layout="stack"');
      expect(readClasses(column)).toEqual(expect.arrayContaining(["flex-col", "items-end", "gap-1"]));
      expect(readClasses(column)).not.toContain("flex-row");
    }
  });

  it("with inline, puts the status and then the controls on one right-aligned line that wraps", () => {
    const html = renderEntry({ sideLayout: "inline", menu: <button type="button">More</button> });
    const column = readOpening(html, "list-entry-column");

    expect(column).toContain('data-side-layout="inline"');
    expect(readClasses(column)).toEqual(expect.arrayContaining(["flex", "flex-row", "flex-wrap", "items-center", "justify-end", "gap-2"]));
    expect(readClasses(column)).not.toContain("flex-col");
    expect(readClasses(column)).not.toContain("items-end");
    expect(html.indexOf('data-slot="list-entry-status"')).toBeLessThan(html.indexOf('data-slot="list-entry-actions"'));
    expect(html.indexOf('data-slot="list-entry-actions"')).toBeLessThan(html.indexOf('data-slot="list-entry-menu"'));
    // The controls keep their touch targets on a phone.
    expect(readClasses(readOpening(html, "list-entry-actions"))).toContain("max-md:*:not-data-[slot=switch]:min-h-touch-target");
  });

  it("with inline, keeps the full-width column for a data-row-wide control", () => {
    const column = readClasses(readOpening(renderEntry({ sideLayout: "inline" }), "list-entry-column"));

    expect(column).toEqual(
      expect.arrayContaining(["has-[[data-row-wide]]:flex-1", "has-[[data-row-wide]]:flex-col", "has-[[data-row-wide]]:items-stretch"]),
    );
  });
});
