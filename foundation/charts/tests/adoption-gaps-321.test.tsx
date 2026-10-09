// Issue #321: semantic colour on swatches and series lines, Area, the tone alias, Sankey and BarList. Oracles are
// written by hand.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Area,
  areaPath,
  BarList,
  CHART_TONES,
  type ChartToneName,
  getBarListRows,
  layoutSankey,
  LegendItem,
  LegendSwatch,
  renderBarListHtml,
  Sankey,
  SeriesLine,
} from "../src/index.js";

const LINE = [
  { x: 0, y: 300 },
  { x: 500, y: 100 },
  { x: 1000, y: 200 },
];

describe("LegendSwatch colour", () => {
  it("keeps the slot markup of earlier versions", () => {
    expect(renderToStaticMarkup(<LegendSwatch slot={2} shape="dot" />)).toBe(
      '<span aria-hidden="true" class="sft-chart-swatch sft-chart-swatch-dot sft-chart-series-2"></span>',
    );
  });

  it("takes a tone, mapped onto the series property", () => {
    expect(renderToStaticMarkup(<LegendSwatch tone="success" shape="dashed" />)).toBe(
      '<span aria-hidden="true" class="sft-chart-swatch sft-chart-swatch-dashed sft-chart-tone-success sft-chart-fill-tone"></span>',
    );
  });

  it("lets a slot win over a tone", () => {
    expect(renderToStaticMarkup(<LegendSwatch slot={1} tone="danger" />)).toContain('class="sft-chart-swatch sft-chart-swatch-line sft-chart-series-1"');
  });

  it("takes an app colour inline, faded, a class, a style and data attributes", () => {
    expect(renderToStaticMarkup(<LegendSwatch color="var(--app-retirement)" faded className="app-swatch" style={{ width: 20 }} data-series="r" />)).toBe(
      '<span data-series="r" aria-hidden="true" class="sft-chart-swatch sft-chart-swatch-line sft-chart-faded app-swatch" style="--sft-chart-series:var(--app-retirement);width:20px"></span>',
    );
  });
});

describe("LegendItem", () => {
  it("is a list item by default", () => {
    expect(renderToStaticMarkup(<LegendItem swatch={null}>Savings</LegendItem>)).toBe('<li class="sft-chart-legend-item"><span>Savings</span></li>');
  });

  it("renders outside a list as a div or a span, faded, with a class", () => {
    expect(renderToStaticMarkup(<LegendItem as="div" swatch={null}>Savings</LegendItem>)).toBe('<div class="sft-chart-legend-item"><span>Savings</span></div>');
    expect(renderToStaticMarkup(<LegendItem as="span" faded className="app-item" swatch={null}>Debt</LegendItem>)).toBe(
      '<span class="sft-chart-legend-item sft-chart-faded app-item"><span>Debt</span></span>',
    );
  });
});

describe("SeriesLine colour", () => {
  it("keeps the slot markup of earlier versions", () => {
    expect(renderToStaticMarkup(<SeriesLine points={LINE} slot={3} dashed />)).toBe(
      '<path class="sft-chart-line sft-chart-series-3 sft-chart-line-dashed" d="M0 300 L500 100 L1000 200"></path>',
    );
  });

  it("takes a tone, a dotted pattern and an app colour", () => {
    expect(renderToStaticMarkup(<SeriesLine points={LINE} tone="warning" pattern="dotted" />)).toBe(
      '<path class="sft-chart-line sft-chart-tone-warning sft-chart-fill-tone sft-chart-line-dotted" d="M0 300 L500 100 L1000 200"></path>',
    );
    expect(renderToStaticMarkup(<SeriesLine points={LINE} color="var(--app-goal)" strokeWidth={3} />)).toBe(
      '<path class="sft-chart-line" style="stroke-width:3;--sft-chart-series:var(--app-goal)" d="M0 300 L500 100 L1000 200"></path>',
    );
  });
});

describe("Area", () => {
  it("fills areaPath in a slot", () => {
    expect(renderToStaticMarkup(<Area points={LINE} slot={1} />)).toBe(`<path class="sft-chart-area sft-chart-series-1" d="${areaPath(LINE)}"></path>`);
  });

  it("takes the baseline, curve, tone, opacity, class and data attributes", () => {
    const lower = LINE.map((point) => ({ x: point.x, y: point.y + 50 }));
    expect(renderToStaticMarkup(<Area points={LINE} baseline={lower} curve="smooth" tone="accent" opacity={0.5} className="app-band" data-band="b" />)).toBe(
      `<path data-band="b" class="sft-chart-area sft-chart-tone-accent sft-chart-fill-tone app-band" style="fill-opacity:0.5" d="${areaPath(LINE, { baseline: lower, curve: "smooth" })}"></path>`,
    );
  });
});

describe("tone names", () => {
  it("lists every tone, and ChartToneName names the same type", () => {
    const tone: ChartToneName = "danger";
    expect(CHART_TONES).toEqual(["cursor", "axis", "grid", "flag", "foreground", "muted", "accent", "danger", "success", "warning"]);
    expect(CHART_TONES).toContain(tone);
  });
});

describe("layoutSankey", () => {
  // In: 60 + 40, out: 50 + 30, so the total is 100. Two nodes on the larger side and a gap of 20 leave 380 units:
  // 3.8 per unit of value. The in side fills the height; the out side (324 tall) and the hub (380) are centred.
  const layout = layoutSankey(
    [
      { key: "a", side: "in", value: 60 },
      { key: "b", side: "in", value: 40 },
      { key: "c", side: "out", value: 50 },
      { key: "d", side: "out", value: 30 },
    ],
    { nodeWidth: 20, gap: 20, labelSpacing: 0 },
  );

  it("stacks each side with gaps and centres the shorter side and the hub", () => {
    const box = ({ x, y, width, height }: { x: number; y: number; width: number; height: number }) => [x, y, width, height];
    expect(layout.inputs.map(box)).toEqual([
      [0, 0, 20, 228],
      [0, 248, 20, 152],
    ]);
    expect(layout.outputs.map(box)).toEqual([
      [980, 38, 20, 190],
      [980, 248, 20, 114],
    ]);
    expect(box(layout.hub)).toEqual([490, 10, 20, 380]);
    expect(layout.total).toBe(100);
  });

  it("draws each ribbon from a node to its slice of the hub", () => {
    expect(layout.inputs[0]?.link).toBe("M20 0 C255 0 255 10 490 10 L490 238 C255 238 255 228 20 228 Z");
    expect(layout.outputs[0]?.link).toBe("M510 10 C745 10 745 38 980 38 L980 228 C745 228 745 200 510 200 Z");
    expect(layout.outputs[1]?.link).toBe("M510 200 C745 200 745 248 980 248 L980 362 C745 362 745 314 510 314 Z");
  });

  it("puts each label on its node's centre when there is room", () => {
    expect(layout.inputs.map((node) => node.labelY)).toEqual([114, 324]);
    expect(layout.outputs.map((node) => node.labelY)).toEqual([133, 305]);
  });

  it("spreads crowded labels to the spacing and keeps them inside the height", () => {
    const top = layoutSankey(
      [
        { key: "x", side: "in", value: 0 },
        { key: "y", side: "in", value: 0 },
        { key: "z", side: "in", value: 100 },
      ],
      { gap: 0, labelSpacing: 40 },
    );
    expect(top.inputs.map((node) => node.labelY)).toEqual([20, 60, 200]);
    const bottom = layoutSankey(
      [
        { key: "z", side: "in", value: 100 },
        { key: "x", side: "in", value: 0 },
        { key: "y", side: "in", value: 0 },
      ],
      { gap: 0, labelSpacing: 40 },
    );
    expect(bottom.inputs.map((node) => node.labelY)).toEqual([200, 340, 380]);
  });

  it("counts a negative value as zero and lays out nothing for no value", () => {
    const empty = layoutSankey([{ key: "a", side: "in", value: -5 }], { nodeWidth: 20 });
    expect(empty.total).toBe(0);
    expect(empty.inputs.map((node) => node.height)).toEqual([0]);
    expect(empty.hub.height).toBe(0);
    expect(layoutSankey([]).inputs).toEqual([]);
  });

  it("shrinks a gap that would take more than half the height", () => {
    const many = layoutSankey(
      Array.from({ length: 5 }, (_, index) => ({ key: String(index), side: "in" as const, value: 1 })),
      { gap: 200, labelSpacing: 0 },
    );
    // Four gaps of 50 (half of 400) leave 200 for five equal nodes.
    expect(many.inputs.map((node) => [node.y, node.height])).toEqual([
      [0, 40],
      [90, 40],
      [180, 40],
      [270, 40],
      [360, 40],
    ]);
  });
});

describe("Sankey", () => {
  const html = renderToStaticMarkup(
    <Sankey
      items={[
        { key: "salary", side: "in", value: 60, label: "Salary", valueLabel: "60", slot: 1 },
        { key: "bonus", side: "in", value: 40, label: "Bonus", valueLabel: "40", tone: "accent", fill: "tint" },
        { key: "rent", side: "out", value: 50, label: "Rent", valueLabel: "50", color: "var(--app-rent)", fill: "hatch" },
        { key: "food", side: "out", value: 30, label: "Food", slot: 2 },
      ]}
      className="app-sankey"
    />,
  );

  it("draws nodes, tinted ribbons and a hub in a hidden SVG", () => {
    expect(html).toMatch(/^<div class="sft-chart-sankey app-sankey">/);
    expect(html).toContain('<svg class="sft-chart-svg" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true" focusable="false">');
    expect(html.match(/class="sft-chart-sankey-link[ "]/g)).toHaveLength(4);
    expect(html).toContain('class="sft-chart-sankey-hub"');
    expect(html).toContain('class="sft-chart-sankey-node sft-chart-series-1"');
    expect(html).toContain('class="sft-chart-sankey-node sft-chart-tone-accent sft-chart-fill-tone sft-chart-sankey-tint"');
  });

  it("hatches a node with a pattern in its own colour", () => {
    const pattern = /<pattern id="([^"]+)" class="sft-chart-sankey-hatch" style="--sft-chart-series:var\(--app-rent\)"/.exec(html);
    expect(pattern).not.toBeNull();
    expect(html).toContain(`fill="url(#${pattern?.[1] ?? ""})"`);
  });

  it("labels nodes in HTML beside the plot, the value under the label", () => {
    expect(html).toContain('<div aria-hidden="true" class="sft-chart-sankey-labels sft-chart-sankey-labels-in">');
    expect(html).toContain('<span class="sft-chart-sankey-label" style="top:28.8%"><span>Salary</span><span class="sft-chart-sankey-value">60</span></span>');
    expect(html).toContain('<span class="sft-chart-sankey-label" style="top:80.8%"><span>Bonus</span>');
    expect(html).toContain('<span>Food</span></span>');
  });
});

describe("BarList", () => {
  const items = [
    { key: "a", label: "Bonds", value: 50, valueLabel: "50 %" },
    { key: "b", label: "Stocks & <ETF>", value: 200, valueLabel: "200 %", slot: 2 },
    { key: "c", label: "Cash", value: -10, valueLabel: "-10 %", tone: "danger" as const },
    { key: "d", label: "Gold", value: 25, valueLabel: "25 %", color: 'red" onclick="x' },
  ];

  it("sizes each bar against the largest value, clamped to 0–100 %", () => {
    expect(getBarListRows(items).map((row) => row.width)).toEqual(["25%", "100%", "0%", "12.5%"]);
    expect(getBarListRows(items, { max: 100 }).map((row) => row.width)).toEqual(["50%", "100%", "0%", "25%"]);
    expect(getBarListRows([{ key: "z", label: "None", value: 0, valueLabel: "0" }]).map((row) => row.width)).toEqual(["0%"]);
  });

  it("renders a list of label, hidden bar and value", () => {
    const html = renderToStaticMarkup(<BarList items={items.slice(0, 1)} className="app-bars" />);
    expect(html).toBe(
      '<ul class="sft-chart-bar-list app-bars"><li class="sft-chart-bar-row"><span class="sft-chart-bar-label">Bonds</span><span aria-hidden="true" class="sft-chart-bar-track"><span class="sft-chart-bar" style="width:100%"></span></span><span class="sft-chart-bar-value">50 %</span></li></ul>',
    );
  });

  it("renders the same markup as an HTML string, escaped", () => {
    for (const props of [{ items }, { items, max: 100, className: "app-bars" }, { items: [] }]) {
      expect(renderBarListHtml(props)).toBe(renderToStaticMarkup(<BarList {...props} />));
    }
    expect(renderBarListHtml({ items })).toContain("Stocks &amp; &lt;ETF&gt;");
    expect(renderBarListHtml({ items })).not.toContain('" onclick="');
  });
});
