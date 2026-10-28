import { describe, expect, it } from "vitest";

import { getThemeColor } from "../src/index.js";
import { createCompleteTheme } from "./support/complete-theme.js";

function createTheme(colors: Record<string, { light: string; dark: string } | { alias: string }>) {
  const theme = createCompleteTheme();
  return { ...theme, colors: { ...theme.colors, ...colors } };
}

describe("getThemeColor", () => {
  it("returns a colour's value for each scheme, light by default", () => {
    const theme = createTheme({ primary: { light: "#0171cf", dark: "#2383e2" } });
    expect(getThemeColor(theme, "primary")).toBe("#0171cf");
    expect(getThemeColor(theme, "primary", "light")).toBe("#0171cf");
    expect(getThemeColor(theme, "primary", "dark")).toBe("#2383e2");
  });

  it("follows an alias and a chain of aliases", () => {
    const theme = createTheme({
      "accent-fill": { light: "#e16259", dark: "#df5452" },
      brand: { alias: "accent-fill" },
      primary: { alias: "brand" },
    });
    expect(getThemeColor(theme, "primary")).toBe("#e16259");
    expect(getThemeColor(theme, "primary", "dark")).toBe("#df5452");
  });

  it("throws on a colour the theme does not define, naming it", () => {
    expect(() => getThemeColor(createCompleteTheme(), "teal")).toThrow('getThemeColor: theme "Complete" has no colour "teal"');
    const theme = createTheme({ primary: { alias: "teal" } });
    expect(() => getThemeColor(theme, "primary")).toThrow('getThemeColor: theme "Complete" has no colour "teal"');
  });

  it("throws on an alias cycle, naming the colours in it", () => {
    const theme = createTheme({ primary: { alias: "brand" }, brand: { alias: "primary" } });
    expect(() => getThemeColor(theme, "primary")).toThrow('getThemeColor: colour "primary" follows a cycle: primary → brand → primary');
  });
});
