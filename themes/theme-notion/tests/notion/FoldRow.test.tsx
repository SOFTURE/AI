import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { readTextNodes } from "../support.js";

import { FoldRow } from "../../src/notion/FoldRow.js";

function readAttribute(html: string, name: string): string[] {
  return [...html.matchAll(new RegExp(`${name}="([^"]+)"`, "g"))].map((match) => match[1] ?? "");
}

function readContentClass(html: string): string | undefined {
  return /<div data-slot="fold-row-content" class="([^"]+)"/.exec(html)?.[1];
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
    expect(html).not.toContain("data-inset");
  });

  it("indents the opened content under the title with isInset", () => {
    const html = renderToStaticMarkup(
      <FoldRow title="Dentist" badges={[]} detailsLabel="Visit details" details={[]} isInset />,
    );

    expect(readContentClass(html)).toBe("flex flex-col gap-2 py-2 pr-1 pl-6 empty:hidden");
    expect(html.startsWith('<details data-slot="fold-row" data-inset="true"')).toBe(true);
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
