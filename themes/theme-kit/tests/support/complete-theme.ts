import { SHADCN_COLOR_ROLES, type ThemeDefinition } from "../../src/index.js";

/** A theme that meets the contract: every shadcn colour role, one token of each other group. */
export function createCompleteTheme(overrides: Partial<ThemeDefinition> = {}): ThemeDefinition {
  return {
    name: "Complete",
    colors: {
      ...Object.fromEntries(SHADCN_COLOR_ROLES.map((role) => [role, { light: "#ffffff", dark: "#000000" }])),
      blue: { light: "#337ea9", dark: "#379ad3" },
      "chart-1": { alias: "blue" },
    },
    shadows: { menu: { light: "0 1px 2px rgba(0, 0, 0, 0.1)", dark: "0 1px 2px rgba(0, 0, 0, 0.4)" } },
    fonts: { sans: "ui-sans-serif, sans-serif" },
    textStyles: { body: { fontSize: "16px", lineHeight: "24px", fontWeight: 400 } },
    radii: { md: "6px" },
    sizes: { "sidebar-width": "240px" },
    clearDefaultPalette: false,
    ...overrides,
  };
}
