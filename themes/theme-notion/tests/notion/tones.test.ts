import { describe, expect, it } from "vitest";

import { PALETTE_COLORS, TONE_COLORS, TONE_EDGE, TONE_FILL, TONE_TEXT, TONES } from "../../src/index.js";

describe("tones", () => {
  it("maps every tone to a palette colour, and only the default to none", () => {
    expect(Object.keys(TONE_COLORS)).toEqual([...TONES]);
    expect(TONE_COLORS).toEqual({ default: null, success: "green", warning: "orange", danger: "red", muted: "gray" });
    for (const color of Object.values(TONE_COLORS)) {
      expect(color === null || (PALETTE_COLORS as readonly string[]).includes(color)).toBe(true);
    }
  });

  it("covers every tone in each class map, in the tone's colour", () => {
    for (const [prefix, map, fallback] of [
      ["text-", TONE_TEXT, "text-foreground"],
      ["bg-", TONE_FILL, "bg-gray"],
      ["border-l-", TONE_EDGE, "border-l-gray"],
    ] as const) {
      expect(Object.keys(map)).toEqual([...TONES]);
      for (const tone of TONES) {
        const color = TONE_COLORS[tone];
        expect([tone, map[tone]]).toEqual([tone, color === null ? fallback : `${prefix}${color}`]);
      }
    }
  });
});
