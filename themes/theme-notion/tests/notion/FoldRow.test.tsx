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

  it("pads the opened content equally on all four sides by default", () => {
    const html = renderToStaticMarkup(
      <FoldRow title="Dentist" badges={[]} detailsLabel="Visit details" details={[]} />,
    );

    expect(readContentClass(html)).toBe("flex flex-col gap-2 p-3 empty:hidden");
    expect(html).toContain('<div data-slot="fold-row-content" data-inset="false"');
  });

  it("indents the opened content under the title with isInset", () => {
    const html = renderToStaticMarkup(
      <FoldRow title="Dentist" badges={[]} detailsLabel="Visit details" details={[]} isInset />,
    );

    expect(readContentClass(html)).toBe("flex flex-col gap-2 py-2 pr-1 pl-6 empty:hidden");
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
  function readActionsClasses(html: string): string[] {
    return (/<div data-slot="fold-row-actions" class="([^"]+)"/.exec(html)?.[1] ?? "").split(" ");
  }

  it("draws the actions beside the details, outside the summary, and moves the border to the wrapper", () => {
    const html = renderToStaticMarkup(
      <FoldRow title="clip.mp4" badges={[]} actions={<button type="button">Delete</button>}>
        <p>More</p>
      </FoldRow>,
    );

    expect(html.startsWith('<div data-slot="fold-row-with-actions" class="flex items-start gap-1 border-b border-border">')).toBe(true);
    expect(readAttribute(html, "data-slot")).toEqual([
      "fold-row-with-actions",
      "fold-row",
      "fold-row-summary",
      "fold-row-heading",
      "fold-row-content",
      "fold-row-actions",
    ]);
    expect(html).toContain('<details data-slot="fold-row" class="group/fold-row min-w-0 flex-1">');
    expect(html).toMatch(/<\/details><div data-slot="fold-row-actions"[^>]*><button type="button">Delete<\/button><\/div><\/div>$/);
    expect(/<summary[\s\S]*<\/summary>/.exec(html)?.[0]).not.toContain("Delete");
    expect(readTextNodes(html)).toEqual(["clip.mp4", "More", "Delete"]);
  });

  it("centres the actions on the row height, or on the touch target at the touch size", () => {
    const row = readActionsClasses(renderToStaticMarkup(<FoldRow title="a" badges={[]} actions="x" />));
    const touch = readActionsClasses(renderToStaticMarkup(<FoldRow title="a" badges={[]} actions="x" size="touch" />));

    expect(row).toEqual(["flex", "shrink-0", "items-center", "gap-1", "min-h-row-height"]);
    expect(touch).toEqual(["flex", "shrink-0", "items-center", "gap-1", "min-h-touch-target"]);
  });

  it("keeps the plain row with its own border when the actions are null", () => {
    const html = renderToStaticMarkup(<FoldRow title="a" badges={[]} actions={null} />);

    expect(html.startsWith('<details data-slot="fold-row" class="group/fold-row border-b border-border">')).toBe(true);
    expect(html).not.toContain("fold-row-actions");
  });

  it("renders the row open with isOpenInitially, and closed when it is false", () => {
    const open = renderToStaticMarkup(<FoldRow title="a" badges={[]} isOpenInitially />);
    const closed = renderToStaticMarkup(<FoldRow title="a" badges={[]} isOpenInitially={false} />);
    const withActions = renderToStaticMarkup(<FoldRow title="a" badges={[]} isOpenInitially actions="x" />);

    expect(open.startsWith('<details data-slot="fold-row" open="" class="group/fold-row border-b border-border">')).toBe(true);
    expect(closed).not.toMatch(/<details[^>]* open/);
    expect(withActions).toContain('<details data-slot="fold-row" open="" class="group/fold-row min-w-0 flex-1">');
  });
});
