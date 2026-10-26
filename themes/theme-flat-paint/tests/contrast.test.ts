import { isColorAlias, type ColorValue } from "@softure-ai/theme-kit";
import { describe, expect, it } from "vitest";

import { FLAT_PAINT_THEME } from "../src/index.js";

// WCAG 2.2 AA: 4.5:1 for text (SC 1.4.3), 3:1 for control boundaries, states and the focus ring (SC 1.4.11).
const TEXT_MIN = 4.5;
const NON_TEXT_MIN = 3;

type Scheme = "light" | "dark";
type Rgb = readonly [number, number, number];

const SURFACES = ["background", "surface", "surface-raised"] as const;
const TEXT_ROLES = ["foreground", "muted", "accent", "accessible", "locked", "debt"] as const;

function getTokenValue(name: string, scheme: Scheme): string {
  const value: ColorValue | undefined = (FLAT_PAINT_THEME.colors as Readonly<Record<string, ColorValue>>)[name];
  if (value === undefined) throw new Error(`Unknown colour token "${name}"`);
  return isColorAlias(value) ? getTokenValue(value.alias, scheme) : value[scheme];
}

function parseHex(css: string): Rgb {
  const digits = /^#([0-9a-f]{6})$/i.exec(css)?.[1];
  if (digits === undefined) throw new Error(`Cannot parse colour "${css}"`);
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as unknown as Rgb;
}

function getLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as unknown as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrast(first: string, second: string, scheme: Scheme): number {
  const [lighter, darker] = [getTokenValue(first, scheme), getTokenValue(second, scheme)]
    .map((value) => getLuminance(parseHex(value)))
    .sort((a, b) => b - a) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

describe.each(["light", "dark"] as const)("contrast in the %s scheme", (scheme) => {
  it.each(TEXT_ROLES)("%s reaches 4.5:1 on every surface", (role) => {
    for (const surface of SURFACES) {
      expect([role, surface, getContrast(role, surface, scheme) >= TEXT_MIN]).toEqual([role, surface, true]);
    }
  });

  it("puts black text on lime at 4.5:1 or more", () => {
    expect(getContrast("on-accent", "accent-fill", scheme)).toBeGreaterThanOrEqual(TEXT_MIN);
    expect(getContrast("on-accent", "accent-fill-hover", scheme)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it("puts white text on the deep chart flag at 4.5:1 or more (the lime flag is black on lime, above)", () => {
    expect(getContrast("paper", "lime-deep", scheme)).toBeGreaterThanOrEqual(TEXT_MIN);
  });

  it("draws the focus ring and control boundaries at 3:1 or more on every surface", () => {
    for (const surface of SURFACES) {
      for (const role of ["accent", "line-strong"]) {
        expect([role, surface, getContrast(role, surface, scheme) >= NON_TEXT_MIN]).toEqual([role, surface, true]);
      }
    }
  });
});

describe("lime as paint", () => {
  it("has too little contrast on white to be text, which is why accent text in light is lime-deep", () => {
    expect(getContrast("lime", "paper", "light")).toBeLessThan(NON_TEXT_MIN);
    expect(getTokenValue("accent", "light")).toBe(getTokenValue("lime-deep", "light"));
  });
});
