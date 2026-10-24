import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { readTextNodes } from "../support.js";

import { PropertyList } from "../../src/notion/PropertyList.js";

describe("PropertyList", () => {
  it("renders one label and value row per property, in order", () => {
    const html = renderToStaticMarkup(
      <PropertyList
        items={[
          { label: "Day", value: "12.01.2027" },
          { label: "Status", value: "Done" },
        ]}
      />,
    );
    const text = readTextNodes(html).join(" ");

    expect(html).toContain('data-slot="property-list"');
    expect(html.match(/data-orientation="horizontal"/g)).toHaveLength(2);
    expect(html).toContain("w-40");
    expect(text).toBe("Day 12.01.2027 Status Done");
  });

  it("renders an empty group for no properties", () => {
    expect(renderToStaticMarkup(<PropertyList items={[]} />)).not.toContain("<label");
  });
});
