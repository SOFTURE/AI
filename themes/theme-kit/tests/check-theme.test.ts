import { describe, expect, it } from "vitest";

import { checkTheme, defineTheme, extendTheme } from "../src/index.js";
import { createCompleteTheme } from "./support/complete-theme.js";

function omitColors(names: readonly string[]) {
  return Object.fromEntries(Object.entries(createCompleteTheme().colors).filter(([name]) => !names.includes(name)));
}

describe("checkTheme", () => {
  it("finds no problem in a complete theme", () => {
    expect(checkTheme(createCompleteTheme())).toEqual([]);
  });

  it("names the missing shadcn colour roles in contract order", () => {
    const colors = omitColors(["ring", "background"]);
    expect(checkTheme(createCompleteTheme({ colors }))).toEqual(["missing shadcn colour roles: background, ring"]);
  });

  it("names a token that is not kebab-case, in any group", () => {
    expect(checkTheme(createCompleteTheme({ radii: { "Big Radius": "9px" }, sizes: { row_height: "34px" } }))).toEqual([
      'radius name "Big Radius" is not a lowercase kebab-case name',
      'size name "row_height" is not a lowercase kebab-case name',
    ]);
  });

  it("names an empty value and a value that could break out of the CSS", () => {
    expect(
      checkTheme(createCompleteTheme({ fonts: { sans: " " }, textStyles: { body: { fontSize: "16px}", lineHeight: "24px", fontWeight: 400 } } })),
    ).toEqual([
      'value of "font-sans" is empty or holds one of ; { } < > or a line break',
      'value of "text-body" is empty or holds one of ; { } < > or a line break',
    ]);
  });

  it("names an alias of a colour the theme does not define, and a theme without a name", () => {
    const theme = createCompleteTheme({ name: "" });
    expect(checkTheme({ ...theme, colors: { ...theme.colors, "chart-2": { alias: "teal" } } })).toEqual([
      "the theme has no name",
      'colour "chart-2" follows "teal", which the theme does not define',
    ]);
  });
});

describe("defineTheme", () => {
  it("returns a complete theme unchanged", () => {
    const theme = createCompleteTheme();
    expect(defineTheme(theme)).toBe(theme);
  });

  it("throws with every problem listed", () => {
    const colors = omitColors(["ring"]);
    expect(() => defineTheme(createCompleteTheme({ name: "Broken", colors, radii: { X: "1px" } }))).toThrow(
      'defineTheme: theme "Broken" breaks the theme contract:\n- missing shadcn colour roles: ring\n- radius name "X" is not a lowercase kebab-case name',
    );
  });
});

describe("extendTheme", () => {
  it("lays each group of the overrides over the base and keeps the rest", () => {
    const base = createCompleteTheme();
    const variant = extendTheme(base, {
      name: "Variant",
      colors: { primary: { light: "#e16259", dark: "#df5452" }, brand: { light: "#111111", dark: "#eeeeee" } },
      radii: { lg: "8px" },
    });
    expect(variant).toEqual({
      ...base,
      name: "Variant",
      colors: { ...base.colors, primary: { light: "#e16259", dark: "#df5452" }, brand: { light: "#111111", dark: "#eeeeee" } },
      radii: { md: "6px", lg: "8px" },
    });
  });

  it("replaces a token whole and takes the palette setting from the overrides when given", () => {
    const base = createCompleteTheme();
    const variant = extendTheme(base, {
      name: "Variant",
      textStyles: { body: { fontSize: "15px", lineHeight: "22px", fontWeight: 400 } },
      clearDefaultPalette: true,
    });
    expect([variant.textStyles, variant.clearDefaultPalette]).toEqual([
      { body: { fontSize: "15px", lineHeight: "22px", fontWeight: 400 } },
      true,
    ]);
  });

  it("refuses a variant that breaks the contract", () => {
    expect(() => extendTheme(createCompleteTheme(), { name: "Variant", colors: { "chart-1": { alias: "teal" } } })).toThrow(
      'colour "chart-1" follows "teal", which the theme does not define',
    );
  });
});
