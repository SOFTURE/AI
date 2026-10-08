// Smooth line and area paths. Oracles are hand-computed or structural (ends on the points, no overshoot).
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { areaPath, linePath, PLOT_HEIGHT, type PlotPoint, SeriesLine, smoothLinePath } from "../src/index.js";

/** Rise, plateau, a step, fall: the shapes where a curve tends to overshoot. */
const POINTS: PlotPoint[] = [
  [0, 260],
  [120, 200],
  [240, 120],
  [262, 110],
  [360, 112],
  [480, 118],
  [600, 20],
  [720, 22],
  [840, 60],
  [1000, 140],
].map(([x, y]) => ({ x: x ?? 0, y: y ?? 0 }));

/** The start of a path and each `C` segment's six numbers. */
function readCurves(path: string): { start: number[]; curves: number[][] } {
  const numbers = (text: string) => text.trim().split(/[\s,]+/).map(Number);
  const start = numbers(/^M([^C]+)/.exec(path)?.[1] ?? "");
  const curves = [...path.matchAll(/C([^C]+)/g)].map((match) => numbers(match[1] ?? ""));
  return { start, curves };
}

describe("smoothLinePath", () => {
  it("passes through every point, one C segment per gap", () => {
    const { start, curves } = readCurves(smoothLinePath(POINTS));
    expect(start).toEqual([0, 260]);
    expect(curves.map((curve) => curve.slice(4))).toEqual(POINTS.slice(1).map((point) => [point.x, point.y]));
  });

  it("keeps every control point within its segment's y-range, so it never overshoots", () => {
    const { curves } = readCurves(smoothLinePath(POINTS));
    curves.forEach((curve, i) => {
      const from = POINTS[i]?.y ?? 0;
      const to = POINTS[i + 1]?.y ?? 0;
      for (const y of [curve[1] ?? Number.NaN, curve[3] ?? Number.NaN]) {
        expect(y, `segment ${String(i)}`).toBeGreaterThanOrEqual(Math.min(from, to) - 0.01);
        expect(y, `segment ${String(i)}`).toBeLessThanOrEqual(Math.max(from, to) + 0.01);
      }
    });
  });

  it("draws collinear points as straight segments with thirds as control points", () => {
    expect(smoothLinePath([{ x: 0, y: 0 }, { x: 30, y: 30 }, { x: 60, y: 60 }])).toBe("M0 0 C10 10 20 20 30 30 C40 40 50 50 60 60");
  });

  it("flattens the tangent at an extreme", () => {
    // Peak at (30, 0): the tangent there is zero, so both neighbouring control points sit at y = 0.
    expect(smoothLinePath([{ x: 0, y: 30 }, { x: 30, y: 0 }, { x: 60, y: 30 }])).toBe("M0 30 C10 20 20 0 30 0 C40 0 50 20 60 30");
  });

  it("draws a vertical step as a straight vertical segment", () => {
    expect(smoothLinePath([{ x: 0, y: 100 }, { x: 0, y: 40 }])).toBe("M0 100 C0 100 0 40 0 40");
  });

  it("returns an empty path for no points and a bare move for one", () => {
    expect(smoothLinePath([])).toBe("");
    expect(smoothLinePath([{ x: 5.123, y: 7 }])).toBe("M5.12 7");
  });

  it("draws the same curve backwards when the points are reversed", () => {
    const forward = readCurves(smoothLinePath(POINTS));
    const backward = readCurves(smoothLinePath([...POINTS].reverse()));
    const forwardControls = forward.curves.map((curve) => [curve[0], curve[1], curve[2], curve[3]]);
    const backwardControls = backward.curves.map((curve) => [curve[2], curve[3], curve[0], curve[1]]).reverse();
    expect(backwardControls).toEqual(forwardControls);
  });
});

describe("areaPath", () => {
  const LINE: PlotPoint[] = [
    { x: 0, y: 300 },
    { x: 500, y: 100 },
    { x: 1000, y: 50 },
  ];

  it("closes the line to the bottom of the plot by default", () => {
    expect(areaPath(LINE)).toBe(`M0 300 L500 100 L1000 50 L1000 ${String(PLOT_HEIGHT)} L0 ${String(PLOT_HEIGHT)} Z`);
  });

  it("closes the line to a given baseline", () => {
    expect(areaPath(LINE, { baseline: 350.5 })).toBe("M0 300 L500 100 L1000 50 L1000 350.5 L0 350.5 Z");
  });

  it("closes a band along a lower edge, drawn backwards", () => {
    const lower = LINE.map((point) => ({ x: point.x, y: point.y + 40 }));
    expect(areaPath(LINE, { baseline: lower })).toBe("M0 300 L500 100 L1000 50 L1000 90 L500 140 L0 340 Z");
  });

  it("smooths both edges with curve smooth", () => {
    const lower = LINE.map((point) => ({ x: point.x, y: point.y + 40 }));
    const path = areaPath(LINE, { baseline: lower, curve: "smooth" });
    expect(path.startsWith(smoothLinePath(LINE))).toBe(true);
    expect(path).toBe(`${smoothLinePath(LINE)} ${smoothLinePath([...lower].reverse()).replace(/^M/, "L")} Z`);
    expect(areaPath(LINE, { curve: "smooth" })).toBe(`${smoothLinePath(LINE)} L1000 ${String(PLOT_HEIGHT)} L0 ${String(PLOT_HEIGHT)} Z`);
  });

  it("returns an empty path for no points and closes on the line when the lower edge is empty", () => {
    expect(areaPath([])).toBe("");
    expect(areaPath(LINE, { baseline: [] })).toBe(`${linePath(LINE)} Z`);
  });
});

describe("SeriesLine curve", () => {
  it("stays a polyline by default and draws the smooth path with curve smooth", () => {
    expect(renderToStaticMarkup(<SeriesLine points={POINTS} slot={0} />)).toContain(`d="${linePath(POINTS)}"`);
    const smooth = renderToStaticMarkup(<SeriesLine points={POINTS} slot={0} curve="smooth" />);
    expect(smooth).toContain(`d="${smoothLinePath(POINTS)}"`);
    expect(smooth).not.toContain("curve");
  });
});
