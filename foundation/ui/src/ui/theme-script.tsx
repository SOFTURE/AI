import { getThemeBootScript, type ThemeCookieValues } from "../theme/theme-cookie.js";
import { getThemeColors } from "../theme/theme-css.js";
import { resolveTheme } from "../theme/resolve-theme.js";
import type { SoftureTheme } from "../theme/tokens.js";

export interface ThemeScriptProps {
  /** The theme in use, for the browser bar colour of an explicit choice. */
  readonly theme?: SoftureTheme;
  /** The `design.json` value given to `SoftureThemeProvider`, applied before `theme` (bar colours included). */
  readonly design?: unknown;
  readonly cookieName?: string;
  /** The values stored for each choice; `{ light: "light", dark: "dark" }` by default. */
  readonly cookieValues?: ThemeCookieValues;
  /** CSP nonce for the inline script. */
  readonly nonce?: string;
}

/**
 * The no-flash boot script. Put it first in `<head>` and mark `<html>` with
 * `suppressHydrationWarning`: the script sets `data-theme` on it before React hydrates.
 */
export function ThemeScript({ theme, design, cookieName, cookieValues, nonce }: ThemeScriptProps) {
  const themeColors = getThemeColors(resolveTheme({ theme, design }, "ThemeScript"));
  const script = getThemeBootScript({ cookieName, cookieValues, themeColors });
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />;
}

