// foldText and foldWords: lower case without accents, for matching typed queries against written text.
import { describe, expect, it } from "vitest";
import { foldText, foldWords } from "@softure-ai/core";

describe("foldText", () => {
  it("lowers case and drops accents, keeping spaces and punctuation", () => {
    expect(foldText("Zürich -- ÉTÉ, naïve!")).toBe("zurich -- ete, naive!");
  });

  it("folds the letters NFKD leaves whole, in either case", () => {
    // l with stroke (both cases), o with stroke, d with stroke, sharp s, ae and oe ligatures.
    const text = String.fromCodePoint(0x141, 0xf3, 0x64, 0x17a, 0x20, 0x142, 0x105, 0x6b, 0x61) + " Str\u00f6m \u00d8re \u0110ak Stra\u00dfe \u00c6ther \u0152uvre";
    expect(foldText(text)).toBe(
      "lodz laka strom ore dak strasse aether oeuvre",
    );
  });

  it("gives the empty string for the empty string", () => {
    expect(foldText("")).toBe("");
  });
});

describe("foldWords", () => {
  it("turns everything but letters and digits into single spaces, trimmed", () => {
    expect(foldWords("  Zürich -- ÉTÉ, naïve!  ")).toBe("zurich ete naive");
    expect(foldWords(`Przep${String.fromCodePoint(0x142)}yw: Q3/2026`)).toBe("przeplyw q3 2026");
  });

  it("gives the empty string for text without words", () => {
    expect(foldWords(" -- !! ")).toBe("");
  });
});
