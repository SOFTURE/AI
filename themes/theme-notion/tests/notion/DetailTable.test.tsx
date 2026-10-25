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

  it("renders nothing when no row has a value", () => {
    expect(renderToStaticMarkup(<DetailTable label="Details" rows={[]} />)).toBe("");
    expect(
      renderToStaticMarkup(<DetailTable label="Details" rows={[{ key: "none", label: "None", value: "" }]} />),
    ).toBe("");
  });
});
