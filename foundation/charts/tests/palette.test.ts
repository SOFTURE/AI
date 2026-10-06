// The series palette guard (CH-4): the check itself on palettes with known faults, measured in
// context/archive/2026-10-06-charts-palette-guard/research.md §1, then the default palette of @softure-ai/ui.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_THEME, SCHEME_TOKENS } from "@softure-ai/ui";
import { describe, expect, it } from "vitest";
import { SERIES_SLOTS } from "../src/index.js";
import { checkSeriesPalette, SERIES_GROUNDS, SERIES_TOKENS, type SeriesPaletteFailure } from "../src/testing/index.js";

const PACKAGE_DIR = join(import.meta.dirname, "..");
const FIRST_THREE = ["chart-series-1", "chart-series-2", "chart-series-3"] as const;

/** CH-2's provisional series colours: contrast is fine, green and amber collapse for red-green readers. */
const CH2_PALETTE = {
  light: { ...DEFAULT_THEME.light, "chart-series-1": "#356912", "chart-series-2": "#16171a", "chart-series-3": "#b45309" },
  dark: { ...DEFAULT_THEME.dark, "chart-series-1": "#cff26b", "chart-series-2": "#f2f3f5", "chart-series-3": "#fbbf24" },
};

/** Distances to one decimal: the measurement in research §1 is rounded so. */
function roundDistances(failures: readonly SeriesPaletteFailure[]): unknown[] {
  return failures.map((failure) =>
    failure.kind === "collision" ? { ...failure, distance: Math.round(failure.distance * 10) / 10 } : failure,
  );
}

describe("checkSeriesPalette", () => {
  it("reports CH-2's green and amber as one colour under protan (light) and protan and deutan (dark)", () => {
    const failures = checkSeriesPalette(CH2_PALETTE, { tokens: FIRST_THREE });

    expect(roundDistances(failures)).toEqual([
      { kind: "collision", scheme: "light", pair: "chart-series-1 and chart-series-3", vision: "protan", distance: 4.4, minimum: 10 },
      { kind: "collision", scheme: "dark", pair: "chart-series-1 and chart-series-3", vision: "protan", distance: 8.6, minimum: 10 },
      { kind: "collision", scheme: "dark", pair: "chart-series-1 and chart-series-3", vision: "deutan", distance: 7, minimum: 10 },
    ]);
  });

  it("reports a pale series below 3:1 on each light ground", () => {
    const pale = { light: { ...CH2_PALETTE.light, "chart-series-3": "#d8b4fe" }, dark: CH2_PALETTE.dark };

    const failures = checkSeriesPalette(pale, { tokens: FIRST_THREE }).filter((failure) => failure.kind !== "collision");

    expect(failures.map((failure) => ({ ...failure, ...("ratio" in failure && { ratio: Number(failure.ratio.toFixed(2)) }) }))).toEqual([
      { kind: "low-contrast", scheme: "light", pair: "chart-series-3 on color-background", ratio: 1.65, minimum: 3 },
      { kind: "low-contrast", scheme: "light", pair: "chart-series-3 on color-surface", ratio: 1.77, minimum: 3 },
      { kind: "low-contrast", scheme: "light", pair: "chart-series-3 on color-surface-raised", ratio: 1.77, minimum: 3 },
    ]);
  });

  it("reports a missing token and a var() on every ground and leaves both out of the distances", () => {
    const lightWithoutInk: Partial<typeof CH2_PALETTE.light> = { ...CH2_PALETTE.light };
    delete lightWithoutInk["chart-series-2"];
    const schemes = { light: lightWithoutInk, dark: { ...CH2_PALETTE.dark, "chart-series-1": "var(--brand)" } };

    const failures = checkSeriesPalette(schemes, { tokens: FIRST_THREE });

    expect(failures).toEqual([
      ...SERIES_GROUNDS.map(() => ({ kind: "missing-token", scheme: "light", pair: expect.stringMatching(/^chart-series-2 on /) as unknown, token: "chart-series-2" })),
      ...SERIES_GROUNDS.map(() => ({ kind: "unreadable-color", scheme: "dark", pair: expect.stringMatching(/^chart-series-1 on /) as unknown, token: "chart-series-1", value: "var(--brand)" })),
      // Light still compares 1 and 3 (green and amber); dark has only 2 and 3 left, which stay apart.
      expect.objectContaining({ kind: "collision", scheme: "light", pair: "chart-series-1 and chart-series-3", vision: "protan" }),
    ]);
  });

  it("names both tokens when two of them share one value", () => {
    const schemes = { light: { ...CH2_PALETTE.light, "chart-series-2": "#356912" }, dark: CH2_PALETTE.dark };

    const failures = checkSeriesPalette(schemes, { tokens: ["chart-series-1", "chart-series-2"] });

    expect(failures).toEqual(
      ["normal", "protan", "deutan", "tritan"].map((vision) => ({
        kind: "collision", scheme: "light", pair: "chart-series-1 and chart-series-2", vision, distance: 0, minimum: 10,
      })),
    );
  });

  it("takes a lower minimum and fewer simulations", () => {
    expect(checkSeriesPalette(CH2_PALETTE, { tokens: FIRST_THREE, minDistance: 4 })).toEqual([]);
    expect(checkSeriesPalette(CH2_PALETTE, { tokens: FIRST_THREE, visions: ["tritan"] })).toEqual([]);
    expect(checkSeriesPalette(CH2_PALETTE, { tokens: FIRST_THREE, visions: ["deutan"] }).map((failure) => failure.scheme)).toEqual(["dark"]);
  });

  it("checks an app's own token names and grounds", () => {
    const schemes = {
      light: { paper: "#ffffff", income: "#1e40af", costs: "#16171a" },
      dark: { paper: "#000000", income: "#93c5fd", costs: "#fca5a5" },
    };

    expect(checkSeriesPalette(schemes, { tokens: ["income", "costs"], grounds: ["paper"] })).toEqual([]);
    const strict = checkSeriesPalette(schemes, { tokens: ["income", "costs"], grounds: ["paper"], minDistance: 35 });

    expect(roundDistances(strict)).toEqual([
      ...([["normal", 28.8], ["protan", 30.5], ["deutan", 30.2], ["tritan", 25.5]] as const).map(([vision, distance]) => ({
        kind: "collision", scheme: "light", pair: "income and costs", vision, distance, minimum: 35,
      })),
      { kind: "collision", scheme: "dark", pair: "income and costs", vision: "protan", distance: 32.6, minimum: 35 },
    ]);
  });
});

describe("the default series palette", () => {
  it("keeps 3:1 on every ground and every pair apart in four views, in both schemes", () => {
    expect(checkSeriesPalette()).toEqual([]);
  });

  it("holds six tokens in the documented order, all defined by @softure-ai/ui", () => {
    expect(SERIES_TOKENS).toEqual(["chart-series-1", "chart-series-2", "chart-series-3", "chart-series-4", "chart-series-5", "chart-series-6"]);
    expect(SERIES_TOKENS.filter((token) => !(SCHEME_TOKENS as readonly string[]).includes(token))).toEqual([]);
    expect(SERIES_SLOTS).toBe(6);
  });

  it("has one slot class in styles.css per token and no more", () => {
    const styles = readFileSync(join(PACKAGE_DIR, "styles.css"), "utf8");
    const slots = [...styles.matchAll(/\.sft-chart-series-(\d+) \{\s*--sft-chart-series: var\(--sft-chart-series-(\d+)\);/g)];

    expect(slots.map(([, slot, token]) => [Number(slot), Number(token)])).toEqual(SERIES_TOKENS.map((_, index) => [index + 1, index + 1]));
  });
});

describe("the testing entry", () => {
  it("stays out of the root entry, so the helpers never ship in an app bundle", () => {
    const root = readFileSync(join(PACKAGE_DIR, "src/index.ts"), "utf8");

    expect(root).not.toMatch(/from "\.\/(?:testing|palette\/check-series-palette)/);
  });
});
