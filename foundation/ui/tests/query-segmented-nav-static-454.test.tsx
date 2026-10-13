import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuerySegmentedNav } from "../src/next/index.js";

// Issue #454: rendered with the real `next/navigation` and no App Router context, as an app's static-render tests do.

describe("QuerySegmentedNav outside a Next request (#454)", () => {
  const items = [
    { id: "table", label: "Table" },
    { id: "chart", label: "Chart" },
  ] as const;

  it("renders query-only links and marks the active view the server passed", () => {
    const html = renderToStaticMarkup(<QuerySegmentedNav label="View" param="view" items={items} defaultId="table" active="chart" />);
    expect(html).toMatch(/<a [^>]*href="\?">Table<\/a>/);
    expect(html).toMatch(/<a aria-current="page" [^>]*href="\?view=chart">Chart<\/a>/);
  });
});
