import { getThemeColor } from "@softure-ai/theme-kit";
import { describe, expect, it } from "vitest";

import { FLAT_ATLAS_THEME } from "../src/tokens.js";

type Scheme = "light" | "dark";

function getLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function getContrast(scheme: Scheme, first: string, second: string): number {
  const a = getLuminance(getThemeColor(FLAT_ATLAS_THEME, first, scheme));
  const b = getLuminance(getThemeColor(FLAT_ATLAS_THEME, second, scheme));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// The pairs the design system names, with the minimum it promises: text 4.5:1, outlines and map meanings 3:1.
const PAIRS: readonly [string, string, number][] = [
  ["foreground", "background", 4.5],
  ["foreground", "surface", 4.5],
  ["muted", "background", 4.5],
  ["muted", "surface", 4.5],
  ["accent", "background", 4.5],
  ["on-accent", "accent-fill", 4.5],
  ["line-strong", "background", 3],
  ["line-strong", "surface", 3],
  ["visited", "map-land", 3],
  ["pin-stroke", "place", 3],
];

describe("Flat Atlas contrast", () => {
  describe.each(["light", "dark"] as const)("%s scheme", (scheme) => {
    it.each(PAIRS)("%s on %s holds %f:1", (foreground, background, minimum) => {
      expect(getContrast(scheme, foreground, background)).toBeGreaterThanOrEqual(minimum);
    });
  });

  it.each([
    ["muted", "background"],
    ["muted", "surface"],
    ["muted", "map-ocean"],
  ])("light %s on %s reaches the enhanced 7:1", (foreground, background) => {
    expect(getContrast("light", foreground, background)).toBeGreaterThanOrEqual(7);
  });

  it("sets light land apart from the sea and from the borders between countries", () => {
    expect(getContrast("light", "map-land", "map-ocean")).toBeGreaterThanOrEqual(1.35);
    expect(getContrast("light", "map-land", "map-edge")).toBeGreaterThanOrEqual(1.45);
  });

  it("keeps the planned blue readable as text on passport paper", () => {
    expect(getContrast("light", "planned", "background")).toBeGreaterThanOrEqual(4.5);
  });
});
