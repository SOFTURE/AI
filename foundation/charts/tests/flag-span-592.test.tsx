// Issue #592: a ChartFlag that spans several rows (a two-line chip). Oracles are written by hand.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartFlag } from "../src/index.js";

describe("ChartFlag rows", () => {
  it("renders rows 1 exactly as no rows, on row 0 and on a lower row", () => {
    expect(renderToStaticMarkup(<ChartFlag xPercent={50} rows={1}>Raise</ChartFlag>)).toBe(
      '<span class="sft-chart-flag sft-chart-align-center" style="left:50%">Raise</span>',
    );
    expect(renderToStaticMarkup(<ChartFlag xPercent={50} row={2} rows={1}>Raise</ChartFlag>)).toBe(
      renderToStaticMarkup(<ChartFlag xPercent={50} row={2}>Raise</ChartFlag>),
    );
  });

  it("makes a chip of two rows as tall as its rows, on row 0", () => {
    expect(renderToStaticMarkup(<ChartFlag xPercent={50} rows={2}>Raise</ChartFlag>)).toBe(
      '<span class="sft-chart-flag sft-chart-align-center sft-chart-flag-span" style="left:50%;--sft-chart-flag-rows:2">Raise</span>',
    );
  });

  it("moves a chip of two rows by one row per row, on a lower row", () => {
    expect(renderToStaticMarkup(<ChartFlag xPercent={50} row={1} rows={2}>Raise</ChartFlag>)).toBe(
      '<span class="sft-chart-flag sft-chart-align-center sft-chart-flag-stacked sft-chart-flag-span" style="left:50%;--sft-chart-flag-row:1;--sft-chart-flag-rows:2">Raise</span>',
    );
  });

  it("sizes a free chip of two rows too", () => {
    expect(renderToStaticMarkup(<ChartFlag rows={2}>Raise</ChartFlag>)).toBe(
      '<span class="sft-chart-flag sft-chart-flag-free sft-chart-flag-span" style="--sft-chart-flag-rows:2">Raise</span>',
    );
  });

  it("throws a RangeError for rows that is not a whole number of at least 1", () => {
    expect(() => renderToStaticMarkup(<ChartFlag rows={0}>Raise</ChartFlag>)).toThrow(RangeError);
    expect(() => renderToStaticMarkup(<ChartFlag rows={1.5}>Raise</ChartFlag>)).toThrow(RangeError);
  });

  it("divides the row offset by the chip's rows, 1 when it has none", () => {
    const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    expect(css).toContain("translate: 0 calc(var(--sft-chart-flag-row) * (100% + var(--sft-space-1)) / var(--sft-chart-flag-rows, 1));");
    // The padding goes into a sum of lengths in the span's min-height, so even zero needs a unit there.
    expect(css).toContain("--sft-chart-flag-pad-y: 0px;");
  });
});
