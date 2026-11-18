import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { readTextNodes } from "../support.js";

import { DetailTable } from "../../src/notion/DetailTable.js";

describe("DetailTable", () => {
  it("renders one row header and value per row with a value, in order", () => {
    const html = renderToStaticMarkup(
      <DetailTable
        label="Visit details"
        rows={[
          { key: "day", label: "Day", value: "12.01.2027" },
          { key: "place", label: "Place", value: <strong>Clinic</strong> },
          { key: "cost", label: "Cost", value: 0 },
        ]}
      />,
    );

    expect(html).toContain('data-slot="detail-table"');
    expect(html).toContain('aria-label="Visit details"');
    expect([...html.matchAll(/data-detail="([^"]+)"/g)].map((match) => match[1])).toEqual(["day", "place", "cost"]);
    expect(html.match(/<th scope="row">/g)).toHaveLength(3);
    expect(readTextNodes(html)).toEqual(["Day", "12.01.2027", "Place", "Clinic", "Cost", "0"]);
  });

  it("leaves out rows whose value is null, undefined or empty", () => {
    const html = renderToStaticMarkup(
      <DetailTable
        label="Details"
        rows={[
          { key: "none", label: "None", value: null },
          { key: "missing", label: "Missing", value: undefined },
          { key: "empty", label: "Empty", value: "" },
          { key: "kept", label: "Kept", value: "Yes" },
        ]}
      />,
    );

    expect([...html.matchAll(/data-detail="([^"]+)"/g)].map((match) => match[1])).toEqual(["kept"]);
    expect(readTextNodes(html)).toEqual(["Kept", "Yes"]);
  });

  it("#1349 lays the table out fixed at its container's width, so a long value never widens it", () => {
    const html = renderToStaticMarkup(<DetailTable label="Details" rows={[{ key: "title", label: "Title", value: "A".repeat(400) }]} />);
    const classes = /<table[^>]*class="([^"]+)"/.exec(html)?.[1]?.split(" ") ?? [];
    expect(classes.slice(0, 4)).toEqual(["w-full", "table-fixed", "border-collapse", "text-ui"]);
    // The label column keeps its width; the value wraps anywhere inside the rest (the markup escapes `&`).
    expect(classes).toContain("[&amp;_th]:w-48");
    expect(classes).toContain("[&amp;_td]:wrap-anywhere");
  });

  it("#1349 wraps the table in a frame it measures: under 28rem the label sits above its value", () => {
    const html = renderToStaticMarkup(<DetailTable label="Details" rows={[{ key: "day", label: "Day", value: "12.01.2027" }]} />);
    expect(html.startsWith('<div data-slot="detail-table-frame" class="@container/detail-table w-full min-w-0">')).toBe(true);
    const classes = /<table[^>]*class="([^"]+)"/.exec(html)?.[1]?.split(" ") ?? [];
    // The frame's width decides, not the window's: a column beside a side panel stacks like a phone (the markup escapes `&`).
    expect(classes.filter((name) => name.startsWith("@max-md/detail-table:"))).toEqual([
      "@max-md/detail-table:[&amp;_tr]:block",
      "@max-md/detail-table:[&amp;_tr]:py-1.5",
      "@max-md/detail-table:[&amp;_th]:block",
      "@max-md/detail-table:[&amp;_th]:w-auto",
      "@max-md/detail-table:[&amp;_th]:py-0",
      "@max-md/detail-table:[&amp;_td]:block",
      "@max-md/detail-table:[&amp;_td]:py-0",
    ]);
    expect(classes.some((name) => name.startsWith("max-sm:"))).toBe(false);
  });

  it("renders nothing when no row has a value", () => {
    expect(renderToStaticMarkup(<DetailTable label="Details" rows={[]} />)).toBe("");
    expect(
      renderToStaticMarkup(<DetailTable label="Details" rows={[{ key: "none", label: "None", value: "" }]} />),
    ).toBe("");
  });
});
