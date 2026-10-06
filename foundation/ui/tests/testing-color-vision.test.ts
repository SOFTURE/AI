import { describe, expect, it } from "vitest";
import {
  COLOR_VISIONS,
  colorDistance,
  deltaE2000,
  DEFAULT_MIN_COLOR_DISTANCE,
  findColorCollisions,
  hueDistance,
  labHue,
  minVisionDistance,
  simulateColorVision,
  toLab,
} from "../src/testing/index.js";

// Reference pairs of Sharma, Wu and Dalal (2005), "The CIEDE2000 color-difference formula", each value
// confirmed with colour-science (`colour.delta_E(..., method="CIE 2000")`), an implementation of another kind.
const SHARMA_PAIRS: readonly (readonly [[number, number, number], [number, number, number], number])[] = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[50, 2.5, 0], [73, 25, -18], 27.1492],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[50, 2.5, 0], [50, 3.2592, 0], 0.9533],
  [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
];

describe("deltaE2000", () => {
  it.each(SHARMA_PAIRS)("matches the reference value for %j and %j", (first, second, expected) => {
    expect(deltaE2000(first, second)).toBeCloseTo(expected, 4);
    expect(deltaE2000(second, first)).toBeCloseTo(expected, 4);
  });

  it("is 0 for identical colours", () => {
    expect(deltaE2000([40, 10, -20], [40, 10, -20])).toBe(0);
  });
});

describe("toLab and colorDistance", () => {
  it("puts white at L 100 and black at L 0 (D65)", () => {
    const [lightness, a, b] = toLab("#ffffff");
    expect(lightness).toBeCloseTo(100, 2);
    expect(Math.abs(a)).toBeLessThan(0.05);
    expect(Math.abs(b)).toBeLessThan(0.05);
    expect(toLab("#000000")[0]).toBe(0);
  });

  // Values measured with colour-science (sRGB -> XYZ -> Lab, D65), research.md §3.
  it("measures CIEDE2000 by default and CIE76 on request", () => {
    expect(colorDistance("#b45309", "#b91c1c")).toBeCloseTo(16.21, 1);
    expect(colorDistance("#b45309", "#b91c1c", { metric: "cie76" })).toBeCloseTo(27.14, 1);
    expect(colorDistance("#1d4ed8", "#0e7490")).toBeCloseTo(19.81, 1);
    expect(colorDistance("#1d4ed8", "#0e7490", { metric: "cie76" })).toBeCloseTo(74.37, 1);
  });
});

describe("labHue and hueDistance", () => {
  it("gives the CIELab hue angle in degrees", () => {
    expect(labHue("#be123c")).toBeCloseTo(21.1, 0);
    expect(labHue("#356912")).toBeCloseTo(129.5, 0);
  });

  it("measures the short way round the hue circle", () => {
    // 324.3° and 21.1°: 56.8° across 0°, not 303.2°.
    expect(hueDistance("#c026d3", "#be123c")).toBeCloseTo(56.8, 0);
    expect(hueDistance("#be123c", "#c026d3")).toBeCloseTo(56.8, 0);
    expect(hueDistance("#356912", "#356912")).toBe(0);
  });
});

describe("simulateColorVision", () => {
  it("covers the three dichromacies", () => {
    expect(COLOR_VISIONS).toEqual(["protan", "deutan", "tritan"]);
  });

  it.each(COLOR_VISIONS)("leaves white, black and greys unchanged (%s)", (vision) => {
    for (const grey of ["#ffffff", "#000000", "#808080", "#5b606b"]) {
      const simulated = toLab(simulateColorVision(grey, vision));
      const original = toLab(grey);
      expect(Math.abs(simulated[0] - original[0]), grey).toBeLessThan(1.5);
    }
    expect(simulateColorVision("#ffffff", vision)).toBe("#ffffff");
    expect(simulateColorVision("#000000", vision)).toBe("#000000");
  });

  it.each(["protan", "deutan"] as const)("projects onto the dichromat plane: applying it twice changes nothing (%s)", (vision) => {
    for (const color of ["#be123c", "#356912", "#2563eb", "#b45309"]) {
      const once = simulateColorVision(color, vision);
      expect(colorDistance(simulateColorVision(once, vision), once), color).toBeLessThan(1);
    }
  });

  // Machado, Oliveira and Fernandes (2009), severity 1.0, as computed by colorspacious
  // (`sRGB1+CVD`, `tritanomaly`, severity 100): research.md §4.
  it.each([
    ["#ff0000", "#ff000f"],
    ["#00ff00", "#00f7d9"],
    ["#0000ff", "#006b96"],
    ["#356912", "#336559"],
    ["#b45309", "#c63c47"],
  ])("simulates tritan vision as colorspacious does: %s -> %s", (input, expected) => {
    expect(colorDistance(simulateColorVision(input, "tritan"), expected)).toBeLessThan(1);
  });

  it("collapses the red-green axis for protan and deutan but not for tritan", () => {
    // FIRE_TRACKER measured amber #b45309 and red #b91c1c at ΔE76 6.1 under deuteranopia (RD-5).
    const deutan = colorDistance(simulateColorVision("#b45309", "deutan"), simulateColorVision("#b91c1c", "deutan"), {
      metric: "cie76",
    });
    expect(deutan).toBeCloseTo(6.1, 0);
    // Red and green: far apart in normal and tritan vision, close for protan and deutan.
    const seen = (vision: "protan" | "deutan" | "tritan") =>
      colorDistance(simulateColorVision("#dc2626", vision), simulateColorVision("#16a34a", vision));
    expect(colorDistance("#dc2626", "#16a34a")).toBeGreaterThan(70);
    expect(seen("protan")).toBeLessThan(20);
    expect(seen("deutan")).toBeLessThan(10);
    expect(seen("tritan")).toBeGreaterThan(60);
  });

  it("collapses sky blue and green for tritan only", () => {
    const seen = (vision: "protan" | "deutan" | "tritan") =>
      colorDistance(simulateColorVision("#0ea5e9", vision), simulateColorVision("#22c55e", vision));
    expect(seen("tritan")).toBeLessThan(DEFAULT_MIN_COLOR_DISTANCE);
    expect(seen("protan")).toBeGreaterThan(50);
    expect(seen("deutan")).toBeGreaterThan(50);
  });

  it("throws on a colour it cannot read", () => {
    expect(() => simulateColorVision("red", "protan")).toThrow(/"red"/);
  });
});

describe("minVisionDistance", () => {
  it("is the smallest distance over normal vision and the simulations", () => {
    const all = minVisionDistance("#b45309", "#b91c1c");
    const normal = colorDistance("#b45309", "#b91c1c");
    expect(all).toBeLessThan(normal);
    expect(minVisionDistance("#b45309", "#b91c1c", { visions: [] })).toBe(normal);
  });
});

describe("findColorCollisions", () => {
  it("returns nothing for a palette that stays apart in every vision", () => {
    expect(findColorCollisions(["#000000", "#ffffff", "#2563eb"])).toEqual([]);
  });

  it("reports every colliding pair and vision, not just the first", () => {
    const collisions = findColorCollisions(["#b45309", "#b91c1c", "#ffffff"]);
    expect(collisions.map(({ first, second, vision }) => `${first}/${second}/${vision}`).sort()).toEqual([
      "#b45309/#b91c1c/deutan",
      "#b45309/#b91c1c/protan",
      "#b45309/#b91c1c/tritan",
    ]);
    for (const collision of collisions) expect(collision.distance).toBeLessThan(DEFAULT_MIN_COLOR_DISTANCE);
  });

  it("honours the visions, the metric and the minimum distance", () => {
    expect(findColorCollisions(["#dc2626", "#16a34a"], { visions: ["tritan"] })).toEqual([]);
    expect(findColorCollisions(["#dc2626", "#16a34a"]).map((c) => c.vision)).toEqual(["deutan"]);
    expect(
      findColorCollisions(["#b45309", "#b91c1c"], { visions: [], minDistance: 30, metric: "cie76" }).map((c) => c.vision),
    ).toEqual(["normal"]);
    expect(findColorCollisions(["#b45309", "#b91c1c"], { minDistance: 1 })).toEqual([]);
  });

  it("uses a default minimum of 10 (CIEDE2000)", () => {
    expect(DEFAULT_MIN_COLOR_DISTANCE).toBe(10);
  });
});
