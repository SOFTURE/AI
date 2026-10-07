// A search that repeats the x scale's formula drifts from the drawing; here the pixel goes through
// the scale's inverse, so the cursor and the drawing share one mapping by construction.
import { describe, expect, it } from "vitest";
import { nearestPointIndex } from "./nearest-point.js";
import { linearScale, timeScale } from "./scale.js";

// A chart 720 wide with 8 of padding, so the plot runs from 8 to 712.
const scaleTo = (end: number) => linearScale({ domain: [0, end], range: [8, 712] });
const x = scaleTo(60);

/** Every twelve months, as a yearly chart draws it. */
const POINTS = [0, 12, 24, 36, 48, 60].map((month) => ({ x: month, y: month * 10 }));

const nearestAt = (pixel: number, points = POINTS, scale = x) => nearestPointIndex(points, scale.invert(pixel));

describe("nearestPointIndex", () => {
  it("picks the first point at the left edge and the last at the right", () => {
    expect(nearestAt(0)).toBe(0);
    expect(nearestAt(720)).toBe(POINTS.length - 1);
  });

  it("snaps to the nearest point rather than requiring a hit on the line", () => {
    // Points sit about 140 px apart; 20 px past the third still means the third.
    expect(nearestAt(x(24) + 20)).toBe(2);
    expect(nearestAt(x(24) - 20)).toBe(2);
  });

  it("crosses to the next point past the midpoint, not before", () => {
    const midpoint = (x(12) + x(24)) / 2;
    expect(nearestAt(midpoint - 5)).toBe(1);
    expect(nearestAt(midpoint + 5)).toBe(2);
  });

  it("stays inside the array for positions off either end", () => {
    // A resized SVG can put the pointer outside the viewBox; an index off the array would show an
    // empty tooltip instead of the edge point.
    expect(nearestAt(-500)).toBe(0);
    expect(nearestAt(5_000)).toBe(POINTS.length - 1);
  });

  it("scales to a stated end, not to the last point drawn", () => {
    const drawn = POINTS.slice(0, 3); // months 0, 12, 24 on an axis to month 60
    expect(nearestAt(x(24), drawn)).toBe(2);
    expect(nearestAt(720, drawn)).toBe(2);
    // Half way to month 24 is month 12; scaled to the last point it would be the middle of the axis.
    expect(nearestAt(x(24) / 2 + 4, drawn)).toBe(1);
  });

  it("has no point to report on an empty series", () => {
    expect(nearestPointIndex([], 100)).toBeNull();
  });

  it("finds dates through a time scale", () => {
    const days = [1, 2, 3, 4].map((day) => ({ x: new Date(Date.UTC(2026, 0, day)), y: day }));
    const time = timeScale({ domain: [new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 0, 4))], range: [0, 300] });
    expect(nearestPointIndex(days, time.invert(140))).toBe(1);
    expect(nearestPointIndex(days, new Date(Date.UTC(2026, 0, 3, 11)))).toBe(2);
  });

  it("does not assume the points are sorted, and keeps the first of two equal distances", () => {
    const unsorted = [{ x: 30, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 1 }];
    expect(nearestPointIndex(unsorted, 11)).toBe(1);
    expect(nearestPointIndex(unsorted, 15)).toBe(1);
    expect(nearestPointIndex(unsorted, 29)).toBe(0);
  });
});
