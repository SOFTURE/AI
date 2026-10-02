import type { ReactNode } from "react";
import { themeFromDesignJson } from "../theme/design-json.js";
import { buildThemeCss, mergeThemes } from "../theme/theme-css.js";
import type { SoftureTheme } from "../theme/tokens.js";

export interface SoftureThemeProviderProps {
  /** Token overrides; tokens it does not name keep their defaults (or the app's CSS). */
  readonly theme?: SoftureTheme;
  /** A `design.json` value (Impeccable, schemaVersion 2), applied before `theme`. */
  readonly design?: unknown;
  readonly children?: ReactNode;
}

/**
 * Applies a theme to the page: a `<style>` with the overridden tokens, then the children. Works in
 * server components (no state, no effects). The CSS is unlayered, so it beats the defaults in
 * `@layer softure`. An invalid `design` is a configuration bug and throws on the first render.
 */
export function SoftureThemeProvider({ theme = {}, design, children }: SoftureThemeProviderProps) {
  const css = buildThemeCss(mergeThemes(readDesign(design), theme));
  return (
    <>
      {css === "" ? null : <style data-softure-theme="">{css}</style>}
      {children}
    </>
  );
}

function readDesign(design: unknown): SoftureTheme {
  if (design === undefined) return {};
  const result = themeFromDesignJson(design);
  if (!result.ok) {
    throw new Error(`SoftureThemeProvider could not read the design prop: ${result.error}`);
  }
  return result.value.theme;
}
