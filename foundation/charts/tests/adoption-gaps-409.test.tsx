// Issue #409: a step in a series, distinct colours for an open set of keys, stacked areas, chart surfaces and the
// event axis. Oracles are written by hand.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { areaPath, distinctColors, linePath, SERIES_SLOTS, StackedAreas, stackSeries, withStepAt } from "../src/index.js";

describe("withStepAt", () => {
  const points = [
    { x: 0, y: 10 },
    { x: 50, y: 10 },
    { x: 100, y: 40 },
  ];

  it("inserts the previous value at the step's x, so the line jumps vertically there", () => {
    expect(withStepAt(points, 2)).toEqual([
      { x: 0, y: 10 },
      { x: 50, y: 10 },
      { x: 100, y: 10 },
      { x: 100, y: 40 },
    ]);
    expect(linePath(withStepAt(points, 2))).toBe("M0 10 L50 10 L100 10 L100 40");
  });

  it("keeps the other fields of the stepped point", () => {
    const dated = [
      { x: new Date(Date.UTC(2026, 0, 1)), y: 1, label: "a" },
      { x: new Date(Date.UTC(2026, 1, 1)), y: 5, label: "b" },
    ];
    expect(withStepAt(dated, 1)).toEqual([dated[0], { ...dated[1], y: 1 }, dated[1]]);
  });

  it("returns an unchanged copy for the first point or an index outside the series", () => {
    for (const index of [0, -1, 3, 1.5]) {
      const stepped = withStepAt(points, index);
      expect(stepped).toEqual(points);
      expect(stepped).not.toBe(points);
    }
    expect(withStepAt([], 0)).toEqual([]);
  });
});

describe("distinctColors", () => {
  it("gives every key its own series slot while the palette lasts", () => {
    const keys = ["bonds", "stocks", "cash", "gold", "crypto", "property"];
    const colours = distinctColors(keys);
    expect([...colours.keys()].sort()).toEqual([...keys].sort());
    expect(new Set(colours.values()).size).toBe(SERIES_SLOTS);
    for (const slot of colours.values()) expect(slot >= 1 && slot <= SERIES_SLOTS).toBe(true);
  });

  it("does not depend on the order of the keys", () => {
    const keys = ["bonds", "stocks", "cash", "gold"];
    expect(distinctColors([...keys].reverse())).toEqual(distinctColors(keys));
  });

  it("keeps a key's colour when another key joins, unless the newcomer takes a free colour", () => {
    const before = distinctColors(["bonds"]);
    const after = distinctColors(["bonds", "stocks"]);
    expect(after.get("bonds")).toBe(before.get("bonds"));
    expect(after.get("stocks")).not.toBe(after.get("bonds"));
  });

  it("ignores repeated keys and wraps past the palette", () => {
    expect(distinctColors(["a", "a", "b"]).size).toBe(2);
    const many = distinctColors(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(many.size).toBe(8);
    expect(new Set(many.values()).size).toBe(SERIES_SLOTS);
  });

  it("returns the app's palette values", () => {
    const colours = distinctColors(["north", "south"], ["var(--app-a)", "var(--app-b)"]);
    expect(new Set(colours.values())).toEqual(new Set(["var(--app-a)", "var(--app-b)"]));
  });

  it("throws for an empty palette", () => {
    expect(() => distinctColors(["a"], [])).toThrow(RangeError);
  });
});

describe("stackSeries", () => {
  const a = { key: "a", points: [{ x: 0, y: 1 }, { x: 1, y: 2 }] };
  const b = { key: "b", tone: "muted" as const, points: [{ x: 0, y: 3 }, { x: 1, y: -1 }] };

  it("stacks positive values up and negative values down from zero, per point", () => {
    expect(stackSeries([a, b])).toEqual([
      { key: "a", lower: [{ x: 0, y: 0 }, { x: 1, y: 0 }], upper: [{ x: 0, y: 1 }, { x: 1, y: 2 }] },
      { key: "b", tone: "muted", lower: [{ x: 0, y: 1 }, { x: 1, y: -1 }], upper: [{ x: 0, y: 4 }, { x: 1, y: 0 }] },
    ]);
  });

  it("throws for series that do not share their x values", () => {
    expect(() => stackSeries([a, { key: "c", points: [{ x: 0, y: 1 }] }])).toThrow(/c/);
    expect(() => stackSeries([a, { key: "d", points: [{ x: 0, y: 1 }, { x: 2, y: 1 }] }])).toThrow(/d/);
  });

  it("gives an empty list for no series", () => {
    expect(stackSeries([])).toEqual([]);
  });
});

describe("StackedAreas", () => {
  const bands = stackSeries([
    { key: "a", points: [{ x: 0, y: 1 }, { x: 1, y: 2 }] },
    { key: "b", color: "var(--app-b)", points: [{ x: 0, y: 1 }, { x: 1, y: 1 }] },
  ]);
  const x = (value: Date | number) => Number(value) * 1000;
  const y = (value: number) => 400 - value * 100;

  it("draws one Area per band between its edges, in its slot or its own colour", () => {
    const html = renderToStaticMarkup(
      <svg>
        <StackedAreas bands={bands} x={x} y={y} />
      </svg>,
    );
    const first = areaPath(
      [
        { x: 0, y: 300 },
        { x: 1000, y: 200 },
      ],
      { baseline: [{ x: 0, y: 400 }, { x: 1000, y: 400 }] },
    );
    const second = areaPath(
      [
        { x: 0, y: 200 },
        { x: 1000, y: 100 },
      ],
      { baseline: [{ x: 0, y: 300 }, { x: 1000, y: 200 }] },
    );
    expect(html).toBe(
      `<svg><path data-series="a" class="sft-chart-area sft-chart-series-1" d="${first}"></path><path data-series="b" class="sft-chart-area" style="--sft-chart-series:var(--app-b)" d="${second}"></path></svg>`,
    );
  });

  it("passes curve and opacity to every band", () => {
    const html = renderToStaticMarkup(
      <svg>
        <StackedAreas bands={bands.slice(0, 1)} x={x} y={y} curve="smooth" opacity={0.5} />
      </svg>,
    );
    expect(html).toContain('style="fill-opacity:0.5"');
    expect(html).toContain(" C");
  });
});
