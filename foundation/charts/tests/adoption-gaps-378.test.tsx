// Issue #378: BarList stacked layout, missing rows and descriptions; Sankey without label columns, leader lines and a
// fixed aspect ratio. Oracles are written by hand.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarList, getBarListRows, renderBarListHtml } from "../src/index.js";

const STYLES = readFileSync(join(import.meta.dirname, "../styles.css"), "utf8");

describe("BarList rows", () => {
  const items = [
    { key: "a", label: "Bonds", value: 50, valueLabel: "50" },
    { key: "b", label: "Stocks", value: 400, valueLabel: "no data", missing: true, tone: "muted" as const },
    { key: "c", label: "Cash", value: 25, valueLabel: "25", description: "Emergency fund" },
  ];

  it("leaves a missing row out of the default full bar and gives it no width", () => {
    expect(getBarListRows(items).map((row) => [row.width, row.missing])).toEqual([
      ["100%", false],
      ["0%", true],
      ["50%", false],
    ]);
  });

  it("passes the description through", () => {
    expect(getBarListRows(items).map((row) => row.description)).toEqual([undefined, undefined, "Emergency fund"]);
  });
});

describe("BarList", () => {
  it("stacks label and value over a full-width track", () => {
    const html = renderToStaticMarkup(<BarList layout="stacked" items={[{ key: "a", label: "Bonds", value: 1, valueLabel: "1" }]} className="app-bars" />);
    expect(html).toBe(
      '<ul class="sft-chart-bar-list sft-chart-bar-list-stacked app-bars"><li class="sft-chart-bar-row"><span class="sft-chart-bar-label">Bonds</span><span aria-hidden="true" class="sft-chart-bar-track"><span class="sft-chart-bar" style="width:100%"></span></span><span class="sft-chart-bar-value">1</span></li></ul>',
    );
  });

  it("draws a missing row as an empty dashed track in the row's colour", () => {
    const html = renderToStaticMarkup(
      <BarList
        items={[
          { key: "a", label: "Bonds", value: 0, valueLabel: "no data", missing: true, tone: "danger" },
          { key: "b", label: "Gold", value: 0, valueLabel: "no data", missing: true, color: "var(--app-gold)" },
        ]}
      />,
    );
    expect(html).toContain(
      '<span aria-hidden="true" class="sft-chart-bar-track sft-chart-bar-track-missing sft-chart-tone-danger sft-chart-fill-tone"></span><span class="sft-chart-bar-value">no data</span>',
    );
    expect(html).toContain('<span aria-hidden="true" class="sft-chart-bar-track sft-chart-bar-track-missing" style="--sft-chart-series:var(--app-gold)"></span>');
    expect(html).not.toContain('class="sft-chart-bar"');
  });

  it("writes a description line after the value", () => {
    const html = renderToStaticMarkup(<BarList items={[{ key: "a", label: "Cash", value: 1, valueLabel: "1", description: "Emergency fund" }]} />);
    expect(html).toContain('<span class="sft-chart-bar-value">1</span><span class="sft-chart-bar-description">Emergency fund</span></li>');
  });

  it("renders the same markup as an HTML string for every new option, escaped", () => {
    const items = [
      { key: "a", label: "Bonds", value: 50, valueLabel: "50", description: "A & <b>" },
      { key: "b", label: "Gold", value: 0, valueLabel: "none", missing: true, color: 'red" onclick="x' },
      { key: "c", label: "Cash", value: 10, valueLabel: "10", missing: true, slot: 3 },
    ];
    for (const props of [{ items }, { items, layout: "stacked" as const, className: "app" }, { items, layout: "inline" as const }]) {
      expect(renderBarListHtml(props)).toBe(renderToStaticMarkup(<BarList {...props} />));
    }
    expect(renderBarListHtml({ items })).toContain("A &amp; &lt;b&gt;");
    expect(renderBarListHtml({ items })).not.toContain('" onclick="');
  });

  it("styles the stacked layout, the missing track and the description", () => {
    expect(STYLES).toContain(".sft-chart-bar-list-stacked {");
    expect(STYLES).toMatch(/\.sft-chart-bar-track-missing \{[^}]*border: var\(--sft-chart-grid-width\) dashed var\(--sft-chart-series, var\(--sft-chart-axis\)\);/);
    expect(STYLES).toContain(".sft-chart-bar-description {");
  });
});
