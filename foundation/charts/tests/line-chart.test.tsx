import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineChart, type LineChartSeries } from "../src/index.js";

// Midnights in Europe/Warsaw (UTC+1 in winter, UTC+2 from March 29), written by hand.
const JAN_1 = new Date("2025-12-31T23:00:00Z");
const FEB_1 = new Date("2026-01-31T23:00:00Z");
const MAR_1 = new Date("2026-02-28T23:00:00Z");
const APR_1 = new Date("2026-03-31T22:00:00Z");

const SERIES: LineChartSeries[] = [
  {
    key: "savings",
    label: "Savings",
    points: [
      { x: JAN_1, y: 1000 },
      { x: FEB_1, y: 2000 },
      { x: MAR_1, y: 3000 },
      { x: APR_1, y: 4000 },
    ],
  },
  {
    key: "spending",
    label: "Spending",
    dashed: true,
    points: [
      { x: JAN_1, y: 500 },
      { x: FEB_1, y: 600 },
      { x: MAR_1, y: 700 },
      { x: APR_1, y: 800 },
    ],
  },
];

const formatValue = (value: number) => value.toLocaleString("en-US");

function renderChart(series: readonly LineChartSeries[] = SERIES) {
  return renderToStaticMarkup(
    <LineChart
      title="Savings and spending"
      series={series}
      flags={[{ key: "raise", x: MAR_1, label: "Raise" }]}
      locale="en"
      timeZone="Europe/Warsaw"
      formatValue={formatValue}
    />,
  );
}

/** Text of every element matching a class, in order. */
function readTexts(html: string, className: string): string[] {
  return [...html.matchAll(new RegExp(`<span class="${className}[^"]*"[^>]*>([^<]*)</span>`, "g"))].map((match) => match[1] ?? "");
}

describe("LineChart", () => {
  it("backs the chart with a table: the title as caption, one row per date in the app's zone", () => {
    const html = renderChart();
    const table = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
    expect(table).toContain("<caption>Savings and spending</caption>");
    expect(table).toContain('<th scope="col">Date</th><th scope="col">Savings</th><th scope="col">Spending</th>');
    expect([...table.matchAll(/<tr><th scope="row">([^<]*)<\/th><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)].map((match) => match.slice(1))).toEqual([
      ["Jan 1, 2026", "1,000", "500"],
      ["Feb 1, 2026", "2,000", "600"],
      ["Mar 1, 2026", "3,000", "700"],
      ["Apr 1, 2026", "4,000", "800"],
    ]);
  });

  it("labels the value axis from zero to the peak with the caller's format", () => {
    expect(readTexts(renderChart(), "sft-chart-value-label")).toEqual(["0", "1,000", "2,000", "3,000", "4,000"]);
  });

  it("labels the time axis with months, the ends at the edges", () => {
    expect(readTexts(renderChart(), "sft-chart-time-label")).toEqual(["Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026"]);
  });

  it("draws one path per series in its slot, the second dashed, and the legend to match", () => {
    const html = renderChart();
    // The span is 90 days less the hour lost on March 29: 2159 hours. February 1 is 744 hours in
    // (34.46 %), March 1 is 1416 (65.59 %). y: 0…4000 onto 400…16, so 1000 is 400 - 384 / 4 = 304.
    expect(html).toContain('<path class="sft-chart-line sft-chart-series-1" d="M0 304 L344.6 208 L655.86 112 L1000 16"></path>');
    expect(html).toMatch(/<path class="sft-chart-line sft-chart-series-2 sft-chart-line-dashed" d="M0 352/);
    expect(html).toContain('<span aria-hidden="true" class="sft-chart-swatch sft-chart-swatch-dashed sft-chart-series-2"></span><span>Spending</span>');
  });

  it("puts a flag over its date with a dashed guide under it", () => {
    const html = renderChart();
    // March 1 is 1416 of 2159 hours in: 655.86 units, 65.59 %.
    expect(html).toMatch(/<line class="sft-chart-guide sft-chart-guide-dashed" x1="655\.859\d*" y1="0" x2="655\.859\d*" y2="400"><\/line>/);
    expect(html).toContain('<span class="sft-chart-flag sft-chart-align-center" style="left:65.59%">Raise</span>');
  });

  it("wraps the plot in the cursor, named from messages, with an empty live readout", () => {
    const html = renderChart();
    expect(html).toContain(
      'role="group" tabindex="0" aria-label="Savings and spending. Use the left and right arrow keys to move between points, Home and End to jump to the ends."',
    );
    expect(html).toContain('<div class="sft-chart-readout" role="status" aria-live="polite" aria-atomic="true"></div>');
  });

  it("draws a chart without data: a frame, no lines, an empty table body", () => {
    const html = renderChart([]);
    expect(html).toContain("<tbody></tbody>");
    expect(html).not.toContain("sft-chart-line");
    expect(readTexts(html, "sft-chart-value-label")).toEqual(["0"]);
  });

  it("labels the only date of a single point and leaves out flags off its dates", () => {
    const html = renderToStaticMarkup(
      <LineChart
        title="One month"
        series={[{ key: "savings", label: "Savings", points: [{ x: JAN_1, y: 1000 }] }]}
        flags={[{ key: "later", x: MAR_1, label: "Later" }]}
        locale="en"
        timeZone="Europe/Warsaw"
        formatValue={formatValue}
      />,
    );
    expect(readTexts(html, "sft-chart-time-label")).toEqual(["Jan 1"]);
    expect(html).not.toContain("Later");
    expect(html).not.toContain("sft-chart-guide");
  });

  it("refuses series with different dates", () => {
    const [savings, spending] = SERIES;
    if (!savings || !spending) throw new Error("fixture");
    expect(() => renderChart([savings, { ...spending, points: spending.points.slice(1) }])).toThrow(
      new TypeError('LineChart series "spending" does not share the x values of the first series'),
    );
  });

  it("goes below zero for negative values, with the baseline at zero and ticks under it", () => {
    const debt: LineChartSeries[] = [
      {
        key: "net",
        label: "Net worth",
        points: [
          { x: JAN_1, y: -2000 },
          { x: FEB_1, y: -1000 },
          { x: MAR_1, y: 1000 },
          { x: APR_1, y: 2000 },
        ],
      },
    ];
    const html = renderChart(debt);
    expect(readTexts(html, "sft-chart-value-label")).toEqual(["-2,000", "-1,000", "0", "1,000", "2,000"]);
    // y: -2000…2000 onto 384…16 (the trough keeps the same 16 unit gap as the peak), so zero is 200.
    expect(html).toContain('<line class="sft-chart-baseline" x1="0" y1="200" x2="1000" y2="200"></line>');
    expect(html).toContain('<path class="sft-chart-line sft-chart-series-1" d="M0 384 L344.6 292 L655.86 108 L1000 16"></path>');
  });

  it("keeps the baseline at the bottom without negative values", () => {
    expect(renderChart()).toContain('<line class="sft-chart-baseline" x1="0" y1="400" x2="1000" y2="400"></line>');
  });
});
