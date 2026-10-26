import { defineTheme } from "./define-theme.js";
import type { ThemeDefinition } from "./theme-definition.js";

/** What a variant changes: a new name, and per token group only the tokens it adds or replaces. */
export interface ThemeOverrides {
  name: string;
  colors?: ThemeDefinition["colors"];
  shadows?: ThemeDefinition["shadows"];
  fonts?: ThemeDefinition["fonts"];
  textStyles?: ThemeDefinition["textStyles"];
  radii?: ThemeDefinition["radii"];
  sizes?: ThemeDefinition["sizes"];
  clearDefaultPalette?: boolean;
}

/**
 * A theme built on another: each token group of `overrides` is laid over the base's group (a token is replaced
 * whole, never merged field by field), the rest is the base's. Used for a theme that differs from an existing one in
 * a few tokens, and by an app that generates its own variant with `buildThemeCss`. The result is checked like
 * `defineTheme`.
 */
export function extendTheme(base: ThemeDefinition, overrides: ThemeOverrides): ThemeDefinition {
  return defineTheme({
    name: overrides.name,
    colors: { ...base.colors, ...overrides.colors },
    shadows: { ...base.shadows, ...overrides.shadows },
    fonts: { ...base.fonts, ...overrides.fonts },
    textStyles: { ...base.textStyles, ...overrides.textStyles },
    radii: { ...base.radii, ...overrides.radii },
    sizes: { ...base.sizes, ...overrides.sizes },
    clearDefaultPalette: overrides.clearDefaultPalette ?? base.clearDefaultPalette,
  });
}
