import { readFileSync } from "node:fs";

import { SCHEME_TOKENS, SHARED_TOKENS } from "@softure-ai/ui";
import { describe, expect, it } from "vitest";

import { NOTION_THEME } from "../src/index.js";

const bridge = readFileSync(new URL("../src/sft-bridge.css", import.meta.url), "utf8");

// The token families the bridge re-points; spacing, text sizes, motion and chart tokens stay the package's.
const BRIDGED_FAMILY = /^(color|font|radius|shadow)-/;

/** The bridge without its comments. */
const rules = bridge.replace(/\/\*[\s\S]*?\*\//g, "");

/** The scopes the aliases are declared on, in the order of the selector list. */
const ALIAS_SCOPES = [":root", ".light", ".dark", "[data-theme]", "[data-page-frame]"];

function readAliasBlock(): { selectors: string[]; aliases: Map<string, string>; offset: number } {
  const match = /(^|\n)([^{}@]+)\{([^{}]*--sft-[^{}]*)\}/.exec(rules);
  if (match === null) throw new Error("sft-bridge.css has no block of --sft-* aliases");
  const selectors = (match[2] ?? "").split(",").map((selector) => selector.trim());
  const aliases = new Map([...(match[3] ?? "").matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((entry): [string, string] => [entry[1] ?? "", entry[2] ?? ""]));
  return { selectors, aliases, offset: match.index };
}

const { selectors, aliases: frame, offset } = readAliasBlock();

/** Every `--name` the Notion theme defines, as a scheme variable or as a Tailwind theme value. */
const NOTION_VARIABLES = new Set([
  ...Object.keys(NOTION_THEME.colors).map((name) => `--${name}`),
  ...Object.keys(NOTION_THEME.shadows).map((name) => `--shadow-${name}`),
  ...Object.keys(NOTION_THEME.fonts).map((family) => `--font-${family}`),
  ...Object.keys(NOTION_THEME.radii).map((step) => `--radius-${step}`),
]);

describe("sft-bridge.css", () => {
  it("re-points the tokens on every scheme scope, so ui components outside a PageFrame take the theme too (#1260)", () => {
    expect(selectors).toEqual(ALIAS_SCOPES);
  });

  it("declares the aliases outside every @layer, so they beat ui's defaults in @layer softure on the same element", () => {
    const before = rules.slice(0, offset);
    const opened = (before.match(/\{/g) ?? []).length;
    const closed = (before.match(/\}/g) ?? []).length;
    expect(opened - closed).toBe(0);
  });

  it("keeps the PageFrame body rule in @layer base", () => {
    expect(rules).toMatch(/@layer base \{\s*body:has\(\[data-page-frame\]\) \{\s*margin: 0;\s*background-color: var\(--background\);\s*\}\s*\}/);
  });

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
