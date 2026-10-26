import { readFileSync } from "node:fs";

import { SCHEME_TOKENS, SHARED_TOKENS } from "@softure-ai/ui";
import { describe, expect, it } from "vitest";

import { FLAT_PAINT_THEME } from "../src/index.js";

const bridge = readFileSync(new URL("../src/sft-bridge.css", import.meta.url), "utf8");

// The token families the bridge re-points, and the two chart lines; spacing, text sizes, motion and the chart's own
// flag colours stay the package's (its defaults are this design system's values).
const BRIDGED = /^(color|font|radius|shadow)-|^chart-(grid|axis)$/;
// Values that are no token of the theme on purpose: a flat zero shadow and the ink overlay without blur.
const RAW_VALUES = new Map([
  ["--sft-shadow-1", "0 0 #0000"],
  ["--sft-shadow-2", "0 0 #0000"],
  ["--sft-color-overlay", "color-mix(in oklab, var(--ink) 60%, transparent)"],
]);

function readBlock(): Map<string, string> {
  const start = bridge.indexOf(":root,\n.light,\n.dark,\n[data-theme] {");
  if (start === -1) throw new Error("sft-bridge.css has no block on every scheme scope");
  const block = bridge.slice(start, bridge.indexOf("\n}", start));
  return new Map([...block.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((match): [string, string] => [match[1] ?? "", match[2] ?? ""]));
}

const declarations = readBlock();

const THEME_VARIABLES = new Set([
  ...Object.keys(FLAT_PAINT_THEME.colors).map((name) => `--${name}`),
  ...Object.keys(FLAT_PAINT_THEME.fonts).map((family) => `--font-${family}`),
  ...Object.keys(FLAT_PAINT_THEME.radii).map((step) => `--radius-${step}`),
]);

describe("sft-bridge.css", () => {
  it("re-points every colour, font, radius and shadow token of @softure-ai/ui and the chart lines", () => {
    const bridged = [...SCHEME_TOKENS, ...SHARED_TOKENS].filter((name) => BRIDGED.test(name)).map((name) => `--sft-${name}`);
    expect(bridged.length).toBeGreaterThan(20);
    expect([...declarations.keys()].sort()).toEqual(bridged.sort());
  });

  it("points at tokens the theme defines, except the flat shadows and the overlay", () => {
    for (const [name, value] of declarations) {
      const raw = RAW_VALUES.get(name);
      if (raw !== undefined) {
        expect([name, value]).toEqual([name, raw]);
        continue;
      }
      const target = /^(?:var|--theme)\((--[\w-]+)\)$/.exec(value)?.[1];
      expect([name, target !== undefined && THEME_VARIABLES.has(target)]).toEqual([name, true]);
    }
  });
});
