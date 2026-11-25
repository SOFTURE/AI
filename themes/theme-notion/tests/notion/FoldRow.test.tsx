import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { readTextNodes } from "../support.js";

import { FoldRow } from "../../src/notion/FoldRow.js";

function readAttribute(html: string, name: string): string[] {
  return [...html.matchAll(new RegExp(`${name}="([^"]+)"`, "g"))].map((match) => match[1] ?? "");
}

function readContentClass(html: string): string | undefined {
  return /<div data-slot="fold-row-content" data-inset="(?:true|false)" class="([^"]+)"/.exec(html)?.[1];
}

describe("FoldRow", () => {
  it("renders a closed details row with its title, facts, badges and details", () => {
    const html = renderToStaticMarkup(
      <FoldRow
        title="Dentist"
        facts={["12.01.2027", "10:00"]}
        badges={[
          { key: "state", text: "Booked", tone: "success" },
          { key: "cost", text: "To pay", tone: "warning" },
          { key: "area", text: "Health" },
        ]}
        detailsLabel="Visit details"
        details={[
          { key: "place", label: "Place", value: "Clinic" },
          { key: "note", label: "Note", value: "" },
        ]}
      >
        <p>More</p>
      </FoldRow>,
    );

    expect(html.startsWith('<details data-slot="fold-row"')).toBe(true);
    expect(html).not.toMatch(/<details[^>]* open/);
    expect(readAttribute(html, "data-slot")).toEqual([
      "fold-row",
      "fold-row-summary",
      "fold-row-heading",
      "fold-row-fact",
      "fold-row-fact",
      "fold-row-badges",
      "badge",
      "badge",
      "badge",
      "fold-row-content",
      "detail-table-frame",
      "detail-table",
    ]);
    expect(readAttribute(html, "data-badge")).toEqual(["state", "cost", "area"]);
    expect(readAttribute(html, "data-tone")).toEqual(["success", "warning", "default"]);
    expect(html).toContain("bg-green-tag");
    expect(html).toContain("bg-orange-tag");
    expect(html).toContain("bg-default-tag");
    expect(html).toContain('aria-label="Visit details"');
    expect(readAttribute(html, "data-detail")).toEqual(["place"]);
    expect(readTextNodes(html)).toEqual([
      "Dentist",
      "12.01.2027",
      "10:00",
      "Booked",
      "To pay",
      "Health",
      "Place",
      "Clinic",
      "More",
    ]);
  });

  it("leaves out the facts, the badge group and the table when they are empty", () => {
    const html = renderToStaticMarkup(
      <FoldRow title="Dentist" badges={[]} detailsLabel="Visit details" details={[]} />,
    );

    expect(readAttribute(html, "data-slot")).toEqual([
      "fold-row",
      "fold-row-summary",
      "fold-row-heading",
      "fold-row-content",
    ]);
    expect(html).toContain("empty:hidden");
    expect(html).toMatch(/<div data-slot="fold-row-content"[^>]*><\/div>/);
  });

  it("pads the opened content with the summary's 8 px inset, so the table starts under the chevron", () => {
    const html = renderToStaticMarkup(
      <FoldRow title="Dentist" badges={[]} detailsLabel="Visit details" details={[]} />,
    );
    const summaryClasses = (/<summary data-slot="fold-row-summary" class="([^"]+)"/.exec(html)?.[1] ?? "").split(" ");

    expect(summaryClasses).toContain("px-2");
    expect(summaryClasses).not.toContain("px-1");
    expect(readContentClass(html)).toBe("flex flex-col gap-2 px-2 py-3 empty:hidden");
    expect(html).toContain('<div data-slot="fold-row-content" data-inset="false"');
  });

  it("indents the opened content under the title with isInset (8 px inset, 16 px chevron, 8 px gap)", () => {
    const html = renderToStaticMarkup(
      <FoldRow title="Dentist" badges={[]} detailsLabel="Visit details" details={[]} isInset />,
    );

    expect(readContentClass(html)).toBe("flex flex-col gap-2 py-2 pr-2 pl-8 empty:hidden");
    expect(html).toContain('<div data-slot="fold-row-content" data-inset="true"');
  });

  it("renders a summary slot after the chevron in place of the title, facts and badges", () => {
    const html = renderToStaticMarkup(
      <FoldRow summary={<strong>Invoice 12/2026</strong>}>
        <ul>
          <li>Line</li>
        </ul>
      </FoldRow>,
    );

    expect(readAttribute(html, "data-slot")).toEqual([
      "fold-row",
      "fold-row-summary",
      "fold-row-summary-slot",
      "fold-row-content",
    ]);
    expect(html).toMatch(/<summary[^>]*><svg[^>]*lucide-chevron-right/);
    expect(html).not.toContain("detail-table");
    expect(readTextNodes(html)).toEqual(["Invoice 12/2026", "Line"]);
  });
});

describe("FoldRow size", () => {
  function readSummaryClasses(html: string): string[] {
    return (/<summary data-slot="fold-row-summary" class="([^"]+)"/.exec(html)?.[1] ?? "").split(" ");
  }

  it("keeps the summary at the row height by default", () => {
    const classes = readSummaryClasses(renderToStaticMarkup(<FoldRow title="Dentist" badges={[]} />));

    expect(classes).toContain("min-h-row-height");
    expect(classes).not.toContain("min-h-touch-target");
  });

  it("makes the summary at least the touch target high at the touch size", () => {
    const classes = readSummaryClasses(renderToStaticMarkup(<FoldRow title="Dentist" badges={[]} size="touch" />));

    expect(classes).toContain("min-h-touch-target");
    expect(classes).not.toContain("min-h-row-height");
  });
});

describe("FoldRow actions", () => {
  function readSlotClasses(html: string, slot: string): string[] {
    return (new RegExp(`data-slot="${slot}"[^>]* class="([^"]+)"`).exec(html)?.[1] ?? "").split(" ");
  }

  it("lays the details and the action column out as one bar, with the opened content in the row below", () => {
    const html = renderToStaticMarkup(
      <FoldRow title="clip.mp4" badges={[]} actions={<button type="button">Delete</button>}>
        <p>More</p>
      </FoldRow>,
    );

    expect(html.startsWith('<div data-slot="fold-row-with-actions" class="group/fold-row-with-actions grid grid-cols-1 border-b border-border md:grid-cols-[minmax(0,1fr)_auto]">')).toBe(true);
    expect(readAttribute(html, "data-slot")).toEqual([
      "fold-row-with-actions",
      "fold-row",
      "fold-row-summary",
      "fold-row-heading",
      "fold-row-actions",
      "fold-row-action-list",
      "fold-row-content",
    ]);
    // The details holds only its summary, so its box is the summary's and the column stretches to it.
    expect(html).toMatch(/<details data-slot="fold-row"[^>]*><summary[\s\S]*<\/summary><\/details><div data-slot="fold-row-actions"/);
    expect(/<summary[\s\S]*<\/summary>/.exec(html)?.[0]).not.toContain("Delete");
    expect(html).toMatch(/<div data-slot="fold-row-action-list"[^>]*><button type="button">Delete<\/button><\/div><\/div><div data-slot="fold-row-content"/);
    expect(readTextNodes(html)).toEqual(["clip.mp4", "Delete", "More"]);
  });

  it("shows the opened content only while the details is open, across the whole row", () => {
    const html = renderToStaticMarkup(
      <FoldRow title="a" badges={[]} actions="x">
        <p>More</p>
      </FoldRow>,
    );
    const inset = renderToStaticMarkup(<FoldRow title="a" badges={[]} actions="x" isInset />);

    expect(readSlotClasses(html, "fold-row-content")).toEqual([
      "col-span-full",
      "hidden",
      "flex-col",
      "gap-2",
      "px-2",
      "py-3",
      "peer-open/fold-row:not-empty:flex",
    ]);
    expect(readSlotClasses(inset, "fold-row-content")).toEqual([
      "col-span-full",
      "hidden",
      "flex-col",
      "gap-2",
      "py-2",
      "pr-2",
      "pl-8",
      "peer-open/fold-row:not-empty:flex",
    ]);
    expect(inset).toContain('data-inset="true"');
  });

  it("stretches the action column to the bar and stacks it under the summary on a phone", () => {
    const column = readSlotClasses(renderToStaticMarkup(<FoldRow title="a" badges={[]} actions="x" />), "fold-row-actions");
    const touch = readSlotClasses(renderToStaticMarkup(<FoldRow title="a" badges={[]} actions="x" size="touch" />), "fold-row-actions");

    expect(column).toEqual([
      "flex",
      "flex-wrap",
      "items-center",
      "gap-2",
      "rounded-b-md",
      "pr-2",
      "pb-1",
      "pl-8",
      "transition-colors",
      "duration-120",
      "group-hover/fold-row-with-actions:bg-accent",
      "peer-open/fold-row:bg-accent",
      "md:flex-col",
      "md:flex-nowrap",
      "md:items-end",
      "md:justify-center",
      "md:gap-1",
      "md:rounded-b-none",
      "md:rounded-r-md",
      "md:py-1",
      "md:pl-0",
    ]);
    // No fixed height: the grid row sets it, whatever the size.
    expect(touch).toEqual(column);
  });

  it("makes each action at least the touch target on a phone", () => {
    const html = renderToStaticMarkup(<FoldRow title="a" badges={[]} actions="x" />);

    expect(readSlotClasses(html, "fold-row-action-list")).toEqual([
      "flex",
      "items-center",
      "gap-1",
      "max-md:*:min-h-touch-target",
      "max-md:*:min-w-touch-target",
    ]);
  });

  it("draws the status above the actions, and the column for a status alone", () => {
    const both = renderToStaticMarkup(<FoldRow title="a" badges={[]} status={<span>Paid</span>} actions={<button type="button">Delete</button>} />);
    const statusOnly = renderToStaticMarkup(<FoldRow title="a" badges={[]} status="Paid" />);

    expect(both).toMatch(
      /<div data-slot="fold-row-actions"[^>]*><div data-slot="fold-row-status" class="flex items-center"><span>Paid<\/span><\/div><div data-slot="fold-row-action-list"[^>]*><button type="button">Delete<\/button><\/div><\/div>/,
    );
    expect(statusOnly.startsWith('<div data-slot="fold-row-with-actions"')).toBe(true);
    expect(statusOnly).toMatch(/<div data-slot="fold-row-actions"[^>]*><div data-slot="fold-row-status"[^>]*>Paid<\/div><\/div>/);
    expect(statusOnly).not.toContain("fold-row-action-list");
  });

  it("lights the details and the column as one box: open, or hovered anywhere in the row", () => {
    const html = renderToStaticMarkup(<FoldRow title="a" badges={[]} actions="x" />);
    const summary = readSlotClasses(html, "fold-row-summary");

    expect(readSlotClasses(html, "fold-row")).toEqual([
      "group/fold-row",
      "peer/fold-row",
      "min-w-0",
      "rounded-md",
      "transition-colors",
      "duration-120",
      "group-hover/fold-row-with-actions:bg-accent",
      "open:bg-accent",
      "max-md:rounded-b-none",
      "md:rounded-r-none",
    ]);
    // The details carries the light, so the summary has none of its own.
    expect(summary).not.toContain("hover:bg-accent");
    expect(summary).not.toContain("group-open/fold-row:bg-accent");
    expect(summary).toContain("focus-visible:ring-2");
    expect(readSlotClasses(renderToStaticMarkup(<FoldRow title="a" badges={[]} />), "fold-row-summary")).toContain("hover:bg-accent");
  });

  it("keeps the plain row with its own border when the actions and the status are null", () => {
    const html = renderToStaticMarkup(<FoldRow title="a" badges={[]} actions={null} status={null} />);

    expect(html.startsWith('<details data-slot="fold-row" class="group/fold-row border-b border-border">')).toBe(true);
    expect(html).not.toContain("fold-row-actions");
  });

  it("renders the row open with isOpenInitially, and closed when it is false", () => {
    const open = renderToStaticMarkup(<FoldRow title="a" badges={[]} isOpenInitially />);
    const closed = renderToStaticMarkup(<FoldRow title="a" badges={[]} isOpenInitially={false} />);
    const withActions = renderToStaticMarkup(<FoldRow title="a" badges={[]} isOpenInitially actions="x" />);

    expect(open.startsWith('<details data-slot="fold-row" open="" class="group/fold-row border-b border-border">')).toBe(true);
    expect(closed).not.toMatch(/<details[^>]* open/);
    expect(withActions).toContain('<details data-slot="fold-row" open="" class="group/fold-row peer/fold-row min-w-0 ');
  });
});
