import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/preflight.css", import.meta.url), "utf8");
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("preflight.css", () => {
  it("sits in the base layer, so every component and utility overrides it", () => {
    expect(rules.trim().startsWith("@layer base {")).toBe(true);
  });

  it("reaches only design-system elements, with zero specificity", () => {
    const selectors = [...rules.matchAll(/^\s*([^@\s{}][^{}]*)\{/gm)].map((match) => (match[1] ?? "").trim());
    expect(selectors.length).toBeGreaterThan(5);
    for (const selector of selectors) {
      for (const part of selector.split(/,\s*\n\s*/)) expect(part, selector).toMatch(/^:where\(.*\[data-slot\]/);
    }
  });
});
