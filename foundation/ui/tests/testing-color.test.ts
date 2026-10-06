import { describe, expect, it } from "vitest";
import {
  blendColors,
  contrastRatio,
  getContrastLevel,
  parseHexColor,
  relativeLuminance,
  WCAG_CONTRAST,
} from "../src/testing/index.js";

describe("parseHexColor", () => {
  it("reads #rrggbb and #rgb in any case", () => {
    expect(parseHexColor("#356912")).toEqual([0x35, 0x69, 0x12]);
    expect(parseHexColor("#CFF26B")).toEqual([0xcf, 0xf2, 0x6b]);
    expect(parseHexColor("#fa0")).toEqual([0xff, 0xaa, 0x00]);
  });

  it("returns null for anything else", () => {
    for (const value of ["", "356912", "#35691", "#3569120", "#gg0000", "var(--sft-color-accent)", "rgb(0 0 0)"]) {
      expect(parseHexColor(value), value).toBeNull();
    }
  });
});

describe("relativeLuminance and contrastRatio (WCAG 2 definition)", () => {
  it("gives 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBe(1);
  });

  it("gives 21:1 for black on white and 1:1 for a colour on itself, in either order", () => {
    expect(contrastRatio("#000", "#fff")).toBe(21);
    expect(contrastRatio("#fff", "#000")).toBe(21);
    expect(contrastRatio("#356912", "#356912")).toBe(1);
  });

  it("matches the well-known grey boundary: #777777 fails 4.5:1 on white, #767676 passes", () => {
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.478, 3);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.542, 3);
  });

  it("throws on a colour it cannot read, naming the value", () => {
    expect(() => contrastRatio("var(--x)", "#fff")).toThrow(/var\(--x\)/);
  });
});

describe("getContrastLevel", () => {
  it("grades text at 4.5 (AA) and 7 (AAA)", () => {
    expect(getContrastLevel(4.49, "text")).toBe("fail");
    expect(getContrastLevel(4.5, "text")).toBe("AA");
    expect(getContrastLevel(6.99, "text")).toBe("AA");
    expect(getContrastLevel(7, "text")).toBe("AAA");
  });

  it("grades large text at 3 (AA) and 4.5 (AAA)", () => {
    expect(getContrastLevel(2.99, "large-text")).toBe("fail");
    expect(getContrastLevel(3, "large-text")).toBe("AA");
    expect(getContrastLevel(4.5, "large-text")).toBe("AAA");
  });

  it("grades non-text at 3, which has no AAA level", () => {
    expect(getContrastLevel(2.99, "non-text")).toBe("fail");
    expect(getContrastLevel(3, "non-text")).toBe("AA");
    expect(getContrastLevel(21, "non-text")).toBe("AA");
  });

  it("exposes the thresholds it grades by", () => {
    expect(WCAG_CONTRAST).toEqual({
      text: { AA: 4.5, AAA: 7 },
      "large-text": { AA: 3, AAA: 4.5 },
      "non-text": { AA: 3 },
    });
  });
});

describe("blendColors", () => {
  it("paints a tint over a ground with the given opacity, as a browser composites bg-x/25", () => {
    expect(blendColors("#be123c", "#ffffff", 0.25)).toBe("#efc4ce");
    expect(blendColors("#000000", "#ffffff", 0.25)).toBe("#bfbfbf");
  });

  it("returns the ground at 0 and the tint at 1", () => {
    expect(blendColors("#be123c", "#17181a", 0)).toBe("#17181a");
    expect(blendColors("#be123c", "#17181a", 1)).toBe("#be123c");
  });

  it("throws on an opacity outside 0 to 1", () => {
    expect(() => blendColors("#000", "#fff", -0.1)).toThrow(TypeError);
    expect(() => blendColors("#000", "#fff", 1.5)).toThrow(/1\.5/);
  });
});
