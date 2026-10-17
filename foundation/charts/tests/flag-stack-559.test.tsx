// Issue #559: a flag's row on ChartFlag and stacked flags on LineChart. Oracles are written by hand.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartFlag, LineChart, type LineChartFlag, type LineChartProps, type LineChartSeries } from "../src/index.js";

const START = new Date("2026-01-01T00:00:00Z");
const END = new Date("2026-01-11T00:00:00Z");
const SERIES: LineChartSeries[] = [
  {
    key: "savings",
    label: "Savings",
    points: [
      { x: START, y: 1 },
      { x: END, y: 2 },
    ],
  },
];

function day(n: number): Date {
  return new Date(START.getTime() + n * 86_400_000);
}

// x in plot percent: day 5 is 50 %, day 6 is 60 %.
const FLAGS: LineChartFlag[] = [
  { key: "a", x: day(5), label: "Raise" },
  { key: "b", x: day(5), label: "Move" },
  { key: "c", x: day(5), label: "Car" },
  { key: "d", x: day(6), label: "Bonus" },
];

function renderChart(props: Partial<LineChartProps>) {
  return renderToStaticMarkup(
    <LineChart title="Savings" series={SERIES} flags={FLAGS} locale="en" timeZone="UTC" formatValue={String} {...props} />,
  );
}

function chipsOf(markup: string): string[] {
  return [...markup.matchAll(/<span[^>]*class="sft-chart-flag[^"]*"[^>]*>[^<]*<\/span>/g)].map((match) => match[0]);
}

describe("ChartFlag row", () => {
  it("adds nothing on row 0 or without a row", () => {
    const plain = renderToStaticMarkup(<ChartFlag xPercent={50}>Raise</ChartFlag>);
    expect(plain).toBe('<span class="sft-chart-flag sft-chart-align-center" style="left:50%">Raise</span>');
    expect(renderToStaticMarkup(<ChartFlag xPercent={50} row={0}>Raise</ChartFlag>)).toBe(plain);
  });

  it("sets the row as a custom property and the stacked class", () => {
    expect(renderToStaticMarkup(<ChartFlag xPercent={50} row={2}>Raise</ChartFlag>)).toBe(
      '<span class="sft-chart-flag sft-chart-align-center sft-chart-flag-stacked" style="left:50%;--sft-chart-flag-row:2">Raise</span>',
    );
  });
});

describe("LineChart flagStack", () => {
  it("keeps every chip on the top row without flagStack", () => {
    const chips = chipsOf(renderChart({}));
    expect(chips).toHaveLength(4);
    expect(chips.some((chip) => chip.includes("sft-chart-flag-stacked"))).toBe(false);
  });

  it("stacks colliding chips into rows by their widths", () => {
    // Every chip 8 % wide and centred: 46–54 three times and 56–64, so the three at 50 % take rows 0–2.
    const chips = chipsOf(renderChart({ flagStack: { widthOf: () => 8 } }));
    expect(chips).toEqual([
      '<span class="sft-chart-flag sft-chart-align-center" style="left:50%">Raise</span>',
      '<span class="sft-chart-flag sft-chart-align-center sft-chart-flag-stacked" style="left:50%;--sft-chart-flag-row:1">Move</span>',
      '<span class="sft-chart-flag sft-chart-align-center sft-chart-flag-stacked" style="left:50%;--sft-chart-flag-row:2">Car</span>',
      '<span class="sft-chart-flag sft-chart-align-center" style="left:60%">Bonus</span>',
    ]);
  });

  it("applies the gap", () => {
    // 46–54 and 56–64 are 2 apart: a gap of 3 pushes Bonus to row 1.
    const chips = chipsOf(renderChart({ flags: [FLAGS[0]!, FLAGS[3]!], flagStack: { widthOf: () => 8, gap: 3 } }));
    expect(chips[1]).toContain("--sft-chart-flag-row:1");
  });

  it("hides the chips beyond maxRows, keeps their guides and adds one +N chip on the row after the last", () => {
    const markup = renderChart({ flagStack: { widthOf: () => 8, maxRows: 2 } });
    expect(chipsOf(markup)).toEqual([
      '<span class="sft-chart-flag sft-chart-align-center" style="left:50%">Raise</span>',
      '<span class="sft-chart-flag sft-chart-align-center sft-chart-flag-stacked" style="left:50%;--sft-chart-flag-row:1">Move</span>',
      '<span class="sft-chart-flag sft-chart-align-center" style="left:60%">Bonus</span>',
      '<span title="Car" class="sft-chart-flag sft-chart-align-center sft-chart-flag-outline sft-chart-flag-more sft-chart-flag-stacked" style="left:50%;--sft-chart-flag-row:2">+1</span>',
    ]);
    // Four guides: every flag keeps its line.
    expect(markup.match(/sft-chart-guide-dashed/g)).toHaveLength(4);
  });

  it("reads the +N copy from the messages", () => {
    const markup = renderChart({ flagStack: { widthOf: () => 8, maxRows: 1 }, messages: { lineChart: { moreFlags: "{count} more" } } });
    expect(markup).toContain('title="Move, Car"');
    expect(markup).toContain(">2 more</span>");
  });
});
