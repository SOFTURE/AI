import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { readTextNodes } from "../support.js";

import { FoldRow } from "../../src/notion/FoldRow.js";

function readAttribute(html: string, name: string): string[] {
  return [...html.matchAll(new RegExp(`${name}="([^"]+)"`, "g"))].map((match) => match[1] ?? "");
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
});
