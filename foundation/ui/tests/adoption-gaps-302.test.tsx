import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { INPUT_CLASS, MoneyField, NUMBER_INPUT_CLASS, TextField } from "../src/index.js";

// Issue #302: two font-family utilities on one input meet at equal specificity, so the later rule
// in the built sheet wins and number inputs fell back to sans. Each input carries exactly one.

const FONT_FAMILY_UTILITY = /^sft:font-(?:sans|mono|serif)$/;

function getInputClasses(html: string): string[] {
  return (html.match(/<input [^>]*class="([^"]*)"/)?.[1] ?? "").split(" ");
}

function getFontFamilies(classes: readonly string[]): string[] {
  return classes.filter((name) => FONT_FAMILY_UTILITY.test(name));
}

describe("one font family per input (#302)", () => {
  it("NUMBER_INPUT_CLASS sets only the mono family, the placeholder stays sans", () => {
    const classes = NUMBER_INPUT_CLASS.split(" ");
    expect(getFontFamilies(classes)).toEqual(["sft:font-mono"]);
    expect(classes).toContain("sft:placeholder:font-sans");
    expect(classes).toContain("sft:tabular-nums");
  });

  it("INPUT_CLASS sets only the sans family", () => {
    expect(getFontFamilies(INPUT_CLASS.split(" "))).toEqual(["sft:font-sans"]);
  });

  it("MoneyField, with and without a suffix, renders a mono input", () => {
    for (const suffix of [undefined, "PLN"]) {
      const html = renderToStaticMarkup(<MoneyField id="m" name="m" label="M" suffix={suffix} />);
      expect(getFontFamilies(getInputClasses(html))).toEqual(["sft:font-mono"]);
    }
  });

  it("TextField renders a mono input for numeric input and a sans one otherwise", () => {
    const numeric = renderToStaticMarkup(<TextField id="a" name="a" label="A" inputMode="decimal" />);
    const text = renderToStaticMarkup(<TextField id="a" name="a" label="A" />);
    expect(getFontFamilies(getInputClasses(numeric))).toEqual(["sft:font-mono"]);
    expect(getFontFamilies(getInputClasses(text))).toEqual(["sft:font-sans"]);
  });
});
