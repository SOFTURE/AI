import { readFileSync } from "node:fs";

import { getThemeColor } from "@softure-ai/theme-kit";
import { describe, expect, it } from "vitest";

import { FLAT_ATLAS_THEME } from "../src/tokens.js";

interface FixtureColor {
  name: string;
  value: string | { light: string; dark: string };
}

interface FixtureStyle {
  name: string;
  fontSize: string;
  lineHeight: number | string;
  letterSpacing: string;
  fontWeight: number;
}

interface Fixture {
  color: { tokens: FixtureColor[] };
  type: { families: Record<string, string>; groups: { styles: FixtureStyle[] }[] };
  radius: { tokens: { name: string; value: string }[] };
  size: { tokens: { name: string; value: string }[] };
}

const FIXTURE = JSON.parse(readFileSync(new URL("fixtures/flat-atlas-tokens.json", import.meta.url), "utf8")) as Fixture;
const PALETTE = new Map(FIXTURE.color.tokens.flatMap((token) => (typeof token.value === "string" ? [[token.name, token.value]] : [])));

function resolve(value: string): string {
  const reference = /^\{(.+)\}$/.exec(value)?.[1];
  return reference === undefined ? value : (PALETTE.get(reference) ?? `missing ${reference}`);
}

// The snapshot writes px; the theme writes text sizes and px line heights in rem, unitless line heights as they are.
function toRem(value: number | string): string {
  if (typeof value === "number") return String(value);
  const px = /^(\d+(?:\.\d+)?)px$/.exec(value)?.[1];
  return px === undefined ? value : `${String(Number(px) / 16)}rem`;
}

describe("Flat Atlas tokens", () => {
  it("keeps every colour of the design system, in both schemes", () => {
    for (const token of FIXTURE.color.tokens) {
      const expected = typeof token.value === "string" ? { light: token.value, dark: token.value } : { light: resolve(token.value.light), dark: resolve(token.value.dark) };
      const actual = {
        light: getThemeColor(FLAT_ATLAS_THEME, token.name, "light").toUpperCase(),
        dark: getThemeColor(FLAT_ATLAS_THEME, token.name, "dark").toUpperCase(),
      };
      expect([token.name, actual]).toEqual([token.name, { light: expected.light.toUpperCase(), dark: expected.dark.toUpperCase() }]);
    }
  });

  it("keeps the type scale: size, line height, weight and tracking of every style", () => {
    const styles = FIXTURE.type.groups.flatMap((group) => group.styles);
    expect(styles).toHaveLength(12);
    for (const style of styles) {
      const actual = FLAT_ATLAS_THEME.textStyles[style.name as keyof typeof FLAT_ATLAS_THEME.textStyles];
      expect([style.name, actual]).toEqual([
        style.name,
        { fontSize: toRem(style.fontSize), lineHeight: toRem(style.lineHeight), fontWeight: style.fontWeight, letterSpacing: style.letterSpacing },
      ]);
    }
  });

  it("tracks every text style at 0.02em, except the untracked numbers and the 0.1em wordmark", () => {
    const tracking = Object.entries(FLAT_ATLAS_THEME.textStyles).map(([name, style]) => [name, style.letterSpacing]);
    const exceptions = tracking.filter(([, value]) => value !== "0.02em");
    expect(exceptions).toEqual([
      ["hero", "0"],
      ["wordmark", "0.1em"],
      ["postmark-year", "0"],
    ]);
  });

  it("names the three faces: Calistoga for headings, Raleway for text, DM Mono for coordinates and codes", () => {
    expect(FLAT_ATLAS_THEME.fonts).toEqual({
      sans: "Raleway, system-ui, sans-serif",
      display: "Calistoga, Georgia, serif",
      mono: '"DM Mono", ui-monospace, monospace',
    });
  });

  it("keeps the radii and the component sizes", () => {
    for (const token of FIXTURE.radius.tokens) {
      expect([token.name, FLAT_ATLAS_THEME.radii[token.name.replace(/^radius-/, "") as keyof typeof FLAT_ATLAS_THEME.radii]]).toEqual([token.name, token.value]);
    }
    for (const token of FIXTURE.size.tokens) {
      const name = token.name.replace(/^(size|container)-/, "");
      expect([token.name, FLAT_ATLAS_THEME.sizes[name as keyof typeof FLAT_ATLAS_THEME.sizes]]).toEqual([token.name, token.value]);
    }
  });

  it("is flat: no shadow token at all", () => {
    expect(FLAT_ATLAS_THEME.shadows).toEqual({});
  });
});
