// One theme from the two ways an app passes it: a `design.json` value, then token overrides on top.
// The provider, the boot script and the switch share it, so the bar colours match the page.
import { themeFromDesignJson } from "./design-json.js";
import { mergeThemes } from "./theme-css.js";
import type { SoftureTheme } from "./tokens.js";

export interface ThemeSource {
  /** Token overrides; they win over `design`. */
  readonly theme?: SoftureTheme;
  /** A `design.json` value (Impeccable, schemaVersion 2), applied before `theme`. */
  readonly design?: unknown;
}

/**
 * `design` merged with `theme`. An invalid `design` is a configuration bug: it throws, naming the
 * component and the error code.
 */
export function resolveTheme({ theme = {}, design }: ThemeSource, component: string): SoftureTheme {
  if (design === undefined) return theme;
  const result = themeFromDesignJson(design);
  if (!result.ok) throw new Error(`${component} could not read the design prop: ${result.error}`);
  return mergeThemes(result.value.theme, theme);
}
