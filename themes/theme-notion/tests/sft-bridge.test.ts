import { readFileSync } from "node:fs";

import { SCHEME_TOKENS, SHARED_TOKENS } from "@softure-ai/ui";
import { describe, expect, it } from "vitest";

import { NOTION_THEME } from "../src/index.js";

const bridge = readFileSync(new URL("../src/sft-bridge.css", import.meta.url), "utf8");

// The token families the bridge re-points; spacing, text sizes, motion and chart tokens stay the package's.
const BRIDGED_FAMILY = /^(color|font|radius|shadow)-/;

function readFrameBlock(): Map<string, string> {
  const start = bridge.indexOf("[data-page-frame] {");
  if (start === -1) throw new Error("sft-bridge.css has no [data-page-frame] block");
  const block = bridge.slice(start, bridge.indexOf("\n  }", start));
  return new Map([...block.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((match): [string, string] => [match[1] ?? "", match[2] ?? ""]));
}

const frame = readFrameBlock();

/** Every `--name` the Notion theme defines, as a scheme variable or as a Tailwind theme value. */
const NOTION_VARIABLES = new Set([
  ...Object.keys(NOTION_THEME.colors).map((name) => `--${name}`),
  ...Object.keys(NOTION_THEME.shadows).map((name) => `--shadow-${name}`),
  ...Object.keys(NOTION_THEME.fonts).map((family) => `--font-${family}`),
  ...Object.keys(NOTION_THEME.radii).map((step) => `--radius-${step}`),
]);

describe("sft-bridge.css", () => {
  it("re-points every colour, font, radius and shadow token of @softure-ai/ui", () => {
    const bridged = [...SCHEME_TOKENS, ...SHARED_TOKENS].filter((name) => BRIDGED_FAMILY.test(name)).map((name) => `--sft-${name}`);
    expect(bridged.length).toBeGreaterThan(20);
    expect([...frame.keys()].sort()).toEqual(bridged.sort());
  });

  it("points only at Notion tokens the theme defines, never at a raw value", () => {
    for (const [name, value] of frame) {
      const target = /^(?:var|--theme)\((--[\w-]+)\)$/.exec(value)?.[1];
      expect([name, target !== undefined && NOTION_VARIABLES.has(target)]).toEqual([name, true]);
    }
  });
});
