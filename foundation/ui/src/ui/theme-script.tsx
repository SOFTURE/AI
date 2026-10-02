import { getThemeBootScript } from "../theme/theme-cookie.js";
import { getThemeColors } from "../theme/theme-css.js";
import type { SoftureTheme } from "../theme/tokens.js";

export interface ThemeScriptProps {
  /** The theme in use, for the browser bar colour of an explicit choice. */
  readonly theme?: SoftureTheme;
  readonly cookieName?: string;
  /** CSP nonce for the inline script. */
  readonly nonce?: string;
}

/**
 * The no-flash boot script. Put it first in `<head>` and mark `<html>` with
 * `suppressHydrationWarning`: the script sets `data-theme` on it before React hydrates.
 */
export function ThemeScript({ theme, cookieName, nonce }: ThemeScriptProps) {
  const script = getThemeBootScript({ cookieName, themeColors: getThemeColors(theme) });
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />;
}
