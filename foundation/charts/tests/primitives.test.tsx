// The generic chart primitives; app-specific labels and rows stay in the app. Oracles are written by hand.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ChartFlag,
  ChartPin,
  ChartPlot,
  edgeAlign,
  GuideLine,
  LegendSwatch,
  linearScale,
  linePath,
  percent,
  PLOT_HEIGHT,
  PLOT_WIDTH,
  SeriesLine,
  seriesSlot,
  TimeAxis,
  timeAxisTicks,
  timeScale,
  ValueAxis,
  valueAxisTicks,
} from "../src/index.js";

const yScale = linearScale({ domain: [0, 4_000_000], range: [PLOT_HEIGHT, 0] });

/** The labels of a rendered axis with whether each is minor, in order. */
function readLabels(html: string): [string, boolean][] {
  return [...html.matchAll(/<span class="([^"]*)"[^>]*>([^<]*)</g)].map((match) => [match[2] ?? "", /\bsft-chart-minor\b/.test(match[1] ?? "")]);
}

describe("value axis ticks", () => {
  it("adds zero at the bottom and places each tick at its height in percent", () => {
    // 1 mln on a 4 mln scale is 25 % from the bottom.
    expect(valueAxisTicks({ ticks: [1_000_000, 4_000_000], scale: yScale, format: (value) => `${String(value / 1_000_000)}M` })).toEqual([
      { key: 0, label: "0M", fromBottomPercent: 0 },
      { key: 1_000_000, label: "1M", fromBottomPercent: 25 },
      { key: 4_000_000, label: "4M", fromBottomPercent: 100 },
    ]);
  });

  it("does not double a zero that comes with the ticks", () => {
    const ticks = valueAxisTicks({ ticks: [0, 2_000_000], scale: yScale, format: String });
    expect(ticks.map((tick) => tick.key)).toEqual([0, 2_000_000]);
  });

  it("measures heights against a plot with a top gap", () => {
    // Range [400, 40]: the peak sits 40 units (10 %) under the top, so the peak is 90 % from the bottom.
    const scale = linearScale({ domain: [0, 100], range: [PLOT_HEIGHT, 40] });
    expect(valueAxisTicks({ ticks: [50, 100], scale, format: String }).map((tick) => tick.fromBottomPercent)).toEqual([0, 45, 90]);
  });
});

describe("value axis", () => {
  it("hides every other label on narrow screens, counted from the top", () => {
    const html = renderToStaticMarkup(
      <ValueAxis ticks={[1, 2, 3, 4].map((n) => ({ key: n, label: `${String(n)}M`, fromBottomPercent: n * 20 }))} />,
    );
    expect(readLabels(html)).toEqual([
      ["1M", true],
      ["2M", false],
      ["3M", true],
      ["4M", false],
    ]);
  });

  it("with zero and five labels keeps zero, the middle and the top", () => {
    const html = renderToStaticMarkup(
      <ValueAxis ticks={[0, 1, 2, 3, 4].map((n) => ({ key: n, label: `${String(n)}M`, fromBottomPercent: n * 25 }))} />,
    );
    expect(readLabels(html).filter(([, minor]) => minor).map(([label]) => label)).toEqual(["1M", "3M"]);
  });

  it("shows every label under four", () => {
    const html = renderToStaticMarkup(<ValueAxis ticks={[1, 2, 3].map((n) => ({ key: n, label: String(n), fromBottomPercent: n * 30 }))} />);
    expect(html).not.toContain("sft-chart-minor");
  });

  it("places labels by height and leaves positioning to the parent", () => {
    const html = renderToStaticMarkup(<ValueAxis className="app-axis" ticks={[{ key: 1, label: "1", fromBottomPercent: 50 }]} />);
    expect(html).toBe('<div aria-hidden="true" class="sft-chart-value-axis app-axis"><span class="sft-chart-value-label" style="bottom:50%">1</span></div>');
  });
});

describe("time axis", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const end = new Date("2066-01-01T00:00:00Z");
  const xScale = timeScale({ domain: [start, end], range: [0, PLOT_WIDTH] });
  const years = [2030, 2040, 2050, 2060].map((year) => new Date(`${String(year)}-01-01T00:00:00Z`));

  it("labels the ends at the edges and keeps middle ticks away from them, minor", () => {
    const ticks = timeAxisTicks({ ticks: years, unit: "year", scale: xScale, locale: "en-US", timeZone: "UTC", ends: [start, end] });
    // 2030 is at 10 % of 40 years, inside the 12 % margin: dropped. 2040, 2050 and 2060 are at 35, 60 and 85 %.
    expect(ticks.map((tick) => [tick.label, tick.align, tick.minor ?? false])).toEqual([
      ["2026", "start", false],
      ["2040", "center", true],
      ["2050", "center", true],
      ["2060", "center", true],
      ["2066", "end", false],
    ]);
    expect(ticks.map((tick) => Number(tick.xPercent.toFixed(1)))).toEqual([0, 35, 60, 85, 100]);
  });

  it("without ends centres every tick inside the plot", () => {
    const ticks = timeAxisTicks({ ticks: years, unit: "year", scale: xScale, locale: "en-US", timeZone: "UTC" });
    expect(ticks.map((tick) => tick.align)).toEqual(["center", "center", "center", "center"]);
  });

  it("aligns the edges to the edges and the middle on its mark", () => {
    const html = renderToStaticMarkup(
      <TimeAxis
        ticks={[
          { key: "a", label: "2026", xPercent: 0, align: "start" },
          { key: "b", label: "2040", xPercent: 50, align: "center", minor: true },
          { key: "c", label: "2066", xPercent: 100, align: "end" },
        ]}
      />,
    );
    expect(html).toContain('<span class="sft-chart-time-label sft-chart-align-start" style="left:0%">2026</span>');
    expect(html).toContain('<span class="sft-chart-time-label sft-chart-align-center sft-chart-minor" style="left:50%">2040</span>');
    expect(html).toContain('<span class="sft-chart-time-label sft-chart-align-end" style="left:100%">2066</span>');
  });
});

describe("flags", () => {
  it("align to the edge near it and centre in the middle (18/82)", () => {
    expect(edgeAlign(0)).toBe("start");
    expect(edgeAlign(17.9)).toBe("start");
    expect(edgeAlign(18)).toBe("center");
    expect(edgeAlign(82)).toBe("center");
    expect(edgeAlign(82.1)).toBe("end");
  });

  it("are a chip at their position, aligned by that rule", () => {
    expect(renderToStaticMarkup(<ChartFlag xPercent={90}>Retirement</ChartFlag>)).toBe(
      '<span class="sft-chart-flag sft-chart-align-end" style="left:90%">Retirement</span>',
    );
  });
});

describe("pins", () => {
  it("are a column at x with a dashed line from the bottom up to y and a dot on y", () => {
    expect(renderToStaticMarkup(<ChartPin xPercent={40} yPercent={30} />)).toBe(
      '<span class="sft-chart-pin" style="left:40%" aria-hidden="true">' +
        '<span class="sft-chart-pin-line" style="height:30%"></span>' +
        '<span class="sft-chart-pin-dot" style="bottom:30%"></span>' +
        "</span>",
    );
  });

  it("draw the dot alone without the line", () => {
    expect(renderToStaticMarkup(<ChartPin xPercent={40} yPercent={30} line={false} />)).toBe(
      '<span class="sft-chart-pin" style="left:40%" aria-hidden="true"><span class="sft-chart-pin-dot" style="bottom:30%"></span></span>',
    );
  });

  it("fill the dot with a series colour when given a slot", () => {
    const html = renderToStaticMarkup(<ChartPin xPercent={40} yPercent={30} slot={2} />);
    expect(html).toContain('<span class="sft-chart-pin-dot sft-chart-series-2" style="bottom:30%"></span>');
    expect(html).toContain('<span class="sft-chart-pin-line" style="height:30%"></span>');
  });

  it("round positions to two decimals and allow the edges", () => {
    expect(renderToStaticMarkup(<ChartPin xPercent={100} yPercent={33.333333} />)).toBe(
      '<span class="sft-chart-pin" style="left:100%" aria-hidden="true">' +
        '<span class="sft-chart-pin-line" style="height:33.33%"></span>' +
        '<span class="sft-chart-pin-dot" style="bottom:33.33%"></span>' +
        "</span>",
    );
    expect(renderToStaticMarkup(<ChartPin xPercent={0} yPercent={0} />)).toContain('style="left:0%"');
  });

  it("sit in the plot's overlay, after the drawing", () => {
    const html = renderToStaticMarkup(<ChartPlot overlay={<ChartPin xPercent={50} yPercent={50} />} />);
    expect(html.indexOf("</svg>")).toBeLessThan(html.indexOf("sft-chart-pin"));
  });
});

describe("lines and swatches", () => {
  it("a guide line carries its pattern as a class", () => {
    const html = renderToStaticMarkup(
      <svg>
        <GuideLine x={10} y2={100} pattern="dotted" />
      </svg>,
    );
    expect(html).toContain('<line class="sft-chart-guide sft-chart-guide-dotted" x1="10" y1="0" x2="10" y2="100"></line>');
  });

  it("a series is a polyline in its slot, dashed on request", () => {
    const html = renderToStaticMarkup(
      <svg>
        <SeriesLine slot={2} dashed points={[{ x: 0, y: 400 }, { x: 500.123, y: 200 }, { x: 1000, y: 0 }]} />
      </svg>,
    );
    expect(html).toContain('<path class="sft-chart-line sft-chart-series-2 sft-chart-line-dashed" d="M0 400 L500.12 200 L1000 0"></path>');
  });

  it("the path of no points is empty", () => {
    expect(linePath([])).toBe("");
  });

  it("series slots wrap around the palette", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(seriesSlot)).toEqual([1, 2, 3, 4, 5, 6, 1, 2]);
  });

  it("a swatch has the shape and the slot of its series and is decorative", () => {
    expect(renderToStaticMarkup(<LegendSwatch slot={3} shape="dotted" />)).toBe(
      '<span aria-hidden="true" class="sft-chart-swatch sft-chart-swatch-dotted sft-chart-series-3"></span>',
    );
  });
});

describe("plot", () => {
  it("stretches one fixed viewBox, hidden from assistive technology", () => {
    const html = renderToStaticMarkup(<ChartPlot overlay={<span>label</span>} />);
    expect(html).toBe(
      '<div class="sft-chart-plot"><svg class="sft-chart-svg" viewBox="0 0 1000 400" preserveAspectRatio="none" aria-hidden="true" focusable="false"></svg><span>label</span></div>',
    );
  });

  it("percent in style keeps at most two decimals", () => {
    expect(percent(33.333333)).toBe("33.33%");
    expect(percent(50)).toBe("50%");
  });
});
