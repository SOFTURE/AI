// Issue #378: BarList stacked layout, missing rows and descriptions; Sankey without label columns, leader lines and a
// fixed aspect ratio. Oracles are written by hand.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BarList, getBarListRows, layoutSankey, renderBarListHtml, Sankey, type SankeyEntry } from "../src/index.js";

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

describe("layoutSankey leader data", () => {
  it("gives each node its centre and says whether its label was spread away from it", () => {
    const layout = layoutSankey(
      [
        { key: "x", side: "in", value: 0 },
        { key: "y", side: "in", value: 0 },
        { key: "z", side: "in", value: 100 },
      ],
      { gap: 0, labelSpacing: 40 },
    );
    expect(layout.inputs.map((node) => [node.centreY, node.labelY, node.isLabelSpread])).toEqual([
      [0, 20, true],
      [0, 60, true],
      [200, 200, false],
    ]);
  });
});

describe("Sankey variants", () => {
  // In: x and y are empty, so their labels are pushed down from the top (20, 60) away from their centre (0); z fills
  // the height (centre 200). Out: w fills the height too, its label on its centre.
  const items: SankeyEntry[] = [
    { key: "x", side: "in", value: 0, label: "X" },
    { key: "y", side: "in", value: 0, label: "Y" },
    { key: "z", side: "in", value: 100, label: "Z" },
    { key: "w", side: "out", value: 100, label: "W" },
  ];
  const layout = { gap: 0, labelSpacing: 40 };

  it("draws only the plot without label columns", () => {
    const html = renderToStaticMarkup(<Sankey items={items} layout={layout} labels="none" leaders className="app" />);
    expect(html).toMatch(/^<div class="sft-chart-sankey sft-chart-sankey-unlabelled app"><div class="sft-chart-plot"><svg /);
    expect(html).not.toContain("sft-chart-sankey-label");
    expect(html).not.toContain("sft-chart-sankey-leader");
  });

  it("draws a leader from each spread label to its node, between the label column and the plot", () => {
    const html = renderToStaticMarkup(<Sankey items={items} layout={layout} leaders />);
    expect(html).toMatch(/^<div class="sft-chart-sankey sft-chart-sankey-leaders">/);
    expect(html).toContain(
      '</div><div aria-hidden="true" class="sft-chart-sankey-leader-strip sft-chart-sankey-leader-strip-in"><svg class="sft-chart-sankey-leader-svg" viewBox="0 0 1 400" preserveAspectRatio="none" focusable="false"><path class="sft-chart-sankey-leader" d="M0 20 L1 0"></path><path class="sft-chart-sankey-leader" d="M0 60 L1 0"></path></svg></div><div class="sft-chart-plot">',
    );
    expect(html).toContain(
      '</div><div aria-hidden="true" class="sft-chart-sankey-leader-strip sft-chart-sankey-leader-strip-out"><svg class="sft-chart-sankey-leader-svg" viewBox="0 0 1 400" preserveAspectRatio="none" focusable="false"></svg></div><div aria-hidden="true" class="sft-chart-sankey-labels sft-chart-sankey-labels-out">',
    );
  });

  it("draws an output leader from the node at the plot edge to the label", () => {
    const html = renderToStaticMarkup(
      <Sankey
        items={[
          { key: "z", side: "in", value: 100, label: "Z" },
          { key: "a", side: "out", value: 100, label: "A" },
          { key: "b", side: "out", value: 0, label: "B" },
        ]}
        layout={layout}
        leaders
      />,
    );
    // b sits at the bottom (centre 400); its label is pulled up to 380.
    expect(html).toContain('<path class="sft-chart-sankey-leader" d="M0 400 L1 380"></path>');
  });

  it("keeps the plot at the viewBox's aspect ratio, with the viewBox the app picks", () => {
    const html = renderToStaticMarkup(<Sankey items={items} layout={{ ...layout, width: 360, height: 300 }} aspect="fixed" />);
    expect(html).toMatch(/^<div class="sft-chart-sankey sft-chart-sankey-fixed">/);
    expect(html).toContain('<div class="sft-chart-plot" style="aspect-ratio:360 / 300"><svg class="sft-chart-svg" viewBox="0 0 360 300"');
  });

  it("reads separate opacities for ribbons and tinted nodes, falling back to the tint opacity", () => {
    expect(STYLES).toMatch(/\.sft-chart-sankey-link \{[^}]*fill-opacity: var\(--sft-chart-sankey-link-opacity, var\(--sft-chart-tint-opacity, 0\.24\)\);/);
    expect(STYLES).toMatch(/\.sft-chart-sankey-tint \{[^}]*fill-opacity: var\(--sft-chart-sankey-node-opacity, var\(--sft-chart-tint-opacity, 0\.24\)\);/);
  });
});
