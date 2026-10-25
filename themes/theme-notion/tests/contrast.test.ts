import { describe, expect, it } from "vitest";

import { NOTION_THEME } from "../src/index.js";

type Scheme = "light" | "dark";

/** WCAG 2 relative luminance of a `#rrggbb` colour. */
function getLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG 2 contrast ratio of two `#rrggbb` colours, rounded down to two decimals. */
function getContrast(first: string, second: string): number {
  const [lighter, darker] = [getLuminance(first), getLuminance(second)].sort((a, b) => b - a) as [number, number];
  return Math.floor(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

function getColor(token: string, scheme: Scheme): string {
  // A colour is either per scheme or an alias of another token (the chart colours); text roles are per scheme.
  const value = (NOTION_THEME.colors as Readonly<Record<string, Readonly<Partial<Record<Scheme, string>>>>>)[token];
  const color = value?.[scheme];
  if (color === undefined || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`token ${token} (${scheme}) is not a #rrggbb colour: ${String(color)}`);
  return color;
}

const AA_TEXT = 4.5;

const TEXT_ROLES = ["foreground", "muted-foreground", "sidebar-foreground"] as const;
const BACKGROUNDS = ["background", "muted", "sidebar"] as const;
// Text drawn on a solid fill: buttons, badges and the active sidebar item.
const SOLID_PAIRS = [
  ["primary-foreground", "primary"],
  ["destructive-foreground", "destructive"],
  ["sidebar-primary-foreground", "sidebar-primary"],
] as const;
const PAIRS = (["light", "dark"] as const).flatMap((scheme) => [
  ...TEXT_ROLES.flatMap((text) => BACKGROUNDS.map((background) => ({ scheme, text, background, name: `${scheme} ${text} on ${background}` }))),
  ...SOLID_PAIRS.map(([text, background]) => ({ scheme, text, background, name: `${scheme} ${text} on ${background}` })),
]);

describe("text contrast of the design system's tokens", () => {
  it.each(PAIRS)("$name meets WCAG AA", ({ scheme, text, background }) => {
    const contrast = getContrast(getColor(text, scheme), getColor(background, scheme));

    expect(contrast).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("computes WCAG ratios", () => {
    expect([getContrast("#000000", "#ffffff"), getContrast("#ffffff", "#ffffff"), getContrast("#777777", "#ffffff")]).toEqual([21, 1, 4.47]);
  });
});
