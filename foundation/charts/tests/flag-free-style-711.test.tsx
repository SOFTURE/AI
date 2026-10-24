// Issue #711: a free ChartFlag (no xPercent) applies its style whatever rows is. Oracles are written by hand.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartFlag } from "../src/index.js";

describe("ChartFlag style on a free flag", () => {
  it("applies the style on a free flag of one row, by default and with rows 1", () => {
    const expected = '<span class="sft-chart-flag sft-chart-flag-free" style="bottom:40%">57 years</span>';
    expect(renderToStaticMarkup(<ChartFlag style={{ bottom: "40%" }}>57 years</ChartFlag>)).toBe(expected);
    expect(renderToStaticMarkup(<ChartFlag rows={1} style={{ bottom: "40%" }}>57 years</ChartFlag>)).toBe(expected);
  });

  it("applies the style after the rows variable on a free flag of two rows", () => {
    expect(renderToStaticMarkup(<ChartFlag rows={2} style={{ bottom: "40%" }}>57 years</ChartFlag>)).toBe(
      '<span class="sft-chart-flag sft-chart-flag-free sft-chart-flag-span" style="--sft-chart-flag-rows:2;bottom:40%">57 years</span>',
    );
  });

  it("renders no style attribute on a free flag of one row without a style", () => {
    expect(renderToStaticMarkup(<ChartFlag>57 years</ChartFlag>)).toBe('<span class="sft-chart-flag sft-chart-flag-free">57 years</span>');
  });
});
