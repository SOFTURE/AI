import { describe, expect, it } from "vitest";

import { getOgPalette, toOpaqueHex, withAlpha } from "../../src/og/palette.js";
import { COLORS } from "./helpers.js";

describe("getOgPalette", () => {
  it("takes every colour from the brand's roles and derives the tile colours from the foreground", () => {
    expect(getOgPalette(COLORS)).toEqual({
      background: "#0c0c0d",
      foreground: "#f2f3f5",
      muted: "#a3a6ad",
      accent: "#cff26b",
      cta: "#2dd4bf",
      onCta: "#0c0c0d",
      surface: "#f2f3f514",
      border: "#f2f3f529",
    });
  });

  it("follows another brand without any colour of its own", () => {
    const palette = getOgPalette({ ...COLORS, foreground: "#102030", cta: "#ff0000" });
    expect([palette.surface, palette.border, palette.cta]).toEqual(["#10203014", "#10203029", "#ff0000"]);
  });
});

describe("withAlpha", () => {
  it.each([
    ["#abc", "#aabbcc80"],
    ["#ABCD", "#aabbcc80"],
    ["#a1b2c3", "#a1b2c380"],
    ["#a1b2c3ff", "#a1b2c380"],
  ])("puts %s at half alpha as %s", (color, expected) => {
    expect(withAlpha(color, 0x80)).toBe(expected);
  });

  it("pads a small alpha to two digits", () => {
    expect(withAlpha("#000000", 5)).toBe("#00000005");
  });
});

describe("toOpaqueHex", () => {
  it("drops the alpha of an 8-digit colour", () => {
    expect(toOpaqueHex("#ecf1f7f7")).toBe("#ecf1f7");
  });
});
