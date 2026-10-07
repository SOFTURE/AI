// The theme choice: light, dark or system (the default). An explicit choice lives in a cookie that
// a synchronous script in `<head>` reads before the first paint, so the page never flashes the
// wrong theme. No cookie means "system": CSS follows `prefers-color-scheme` on its own. The server
// does not need to read the cookie, so routes stay static. The name and the two stored values are
// configurable, so an app that already stores its own keeps every user's saved choice.
import { isSafeTokenValue } from "./theme-css.js";
import type { ColorScheme } from "./tokens.js";

export type ThemeChoice = ColorScheme | "system";

export const THEME_CHOICES: readonly ThemeChoice[] = ["light", "dark", "system"];

export const DEFAULT_THEME_COOKIE = "sft-theme";

/** A year: the theme is a setting, not a session. */
const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// Cookie names are RFC 6265 tokens; anything else could break out of the boot script's string.
const COOKIE_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

// Cookie values are RFC 6265 cookie octets: no space, quote, comma, semicolon or backslash.
const COOKIE_VALUE = /^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]+$/;

/** The value stored for each explicit choice. */
export type ThemeCookieValues = Readonly<Record<ColorScheme, string>>;

export const DEFAULT_THEME_COOKIE_VALUES: ThemeCookieValues = { light: "light", dark: "dark" };

/** Which cookie holds the choice: its name and the value stored for each scheme. */
export interface ThemeCookieFormat {
  /** The cookie name; `sft-theme` by default. */
  readonly cookieName?: string;
  /** The stored values, `{ light: "light", dark: "dark" }` by default; both must be cookie octets and differ. */
  readonly cookieValues?: ThemeCookieValues;
}

export interface ThemeCookieOptions extends ThemeCookieFormat {
  /** `Domain` of the cookie, to share the choice across subdomains; host-only when absent. */
  readonly domain?: string | null;
}

/**
 * The choice stored in a `Cookie` header or `document.cookie`. Anything but the two known values,
 * including a broken cookie, is "system": better the system theme than a guess.
 */
export function parseThemeCookie(
  cookieHeader: string | null | undefined,
  format: string | ThemeCookieFormat = {},
): ThemeChoice {
  const { cookieName = DEFAULT_THEME_COOKIE, cookieValues } = typeof format === "string" ? { cookieName: format } : format;
  const values = getCookieValues(cookieValues);
  if (!cookieHeader) return "system";
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== cookieName) continue;
    const value = rest.join("=");
    if (value === values.light) return "light";
    if (value === values.dark) return "dark";
  }
  return "system";
}

/** The `document.cookie` string that stores `choice`; "system" deletes the cookie. */
export function buildThemeCookie(choice: ThemeChoice, options: ThemeCookieOptions = {}): string {
  const name = getCookieName(options.cookieName);
  const values = getCookieValues(options.cookieValues);
  const scope = options.domain ? `; Domain=${options.domain}` : "";
  if (choice === "system") return `${name}=; Path=/${scope}; Max-Age=0; SameSite=Lax`;
  return `${name}=${values[choice]}; Path=/${scope}; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export interface ThemeBootScriptOptions extends ThemeCookieFormat {
  /** Browser bar colour per scheme, applied to every `meta[name="theme-color"]` on an explicit choice. */
  readonly themeColors?: Readonly<Record<ColorScheme, string>>;
}

/**
 * The inline `<head>` script: cookie -> `data-theme` on `<html>`. Self-contained (it runs before
 * any bundle) and wrapped in `try`, because blocked cookies must not stop the render. With a strict
 * CSP it needs a nonce or its hash.
 */
export function getThemeBootScript(options: ThemeBootScriptOptions = {}): string {
  const name = getCookieName(options.cookieName);
  const values = toScriptLiteral(getCookieValues(options.cookieValues));
  const themeColors = options.themeColors ?? null;
  for (const color of Object.values(themeColors ?? {})) {
    if (!isSafeTokenValue(color)) throw new TypeError(`Invalid theme bar colour: ${JSON.stringify(color)}`);
  }
  const colors = toScriptLiteral(themeColors);
  const pattern = toScriptLiteral(`(?:^|;\\s*)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`);
  return `(function(){try{var m=document.cookie.match(new RegExp(${pattern}));var v=m&&m[1];var s=${values};var t=v===s.dark?"dark":v===s.light?"light":null;if(!t)return;document.documentElement.setAttribute("data-theme",t);var c=${colors};if(!c)return;document.addEventListener("DOMContentLoaded",function(){var ms=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<ms.length;i++){ms[i].setAttribute("content",c[t]);}});}catch(e){}})();`;
}

export interface ApplyThemeChoiceOptions extends ThemeCookieOptions {
  readonly doc?: Document;
  readonly themeColors?: Readonly<Record<ColorScheme, string>>;
}

/** Applies a choice on the live page (the switch): cookie and attribute in one step, no reload. */
export function applyThemeChoice(choice: ThemeChoice, options: ApplyThemeChoiceOptions = {}): void {
  const doc = options.doc ?? document;
  // A host-only cookie left from before would shadow the domain cookie on this host.
  if (options.domain) doc.cookie = buildThemeCookie("system", { cookieName: options.cookieName, cookieValues: options.cookieValues });
  doc.cookie = buildThemeCookie(choice, options);

  if (choice === "system") {
    doc.documentElement.removeAttribute("data-theme");
  } else {
    doc.documentElement.setAttribute("data-theme", choice);
  }

  const colors = options.themeColors;
  if (!colors) return;
  // "System" gives each meta back its own scheme colour (by its media query); an explicit choice
  // gives both the chosen one.
  for (const meta of Array.from(doc.querySelectorAll('meta[name="theme-color"]'))) {
    const own: ColorScheme = (meta.getAttribute("media") ?? "").includes("dark") ? "dark" : "light";
    meta.setAttribute("content", colors[choice === "system" ? own : choice]);
  }
}

/**
 * A JSON literal that is safe inside an inline `<script>`: `<`, `>`, `/` and the JavaScript line
 * separators are written as `\u` escapes, so no value can close the element or the statement.
 */
function toScriptLiteral(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>/\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function getCookieName(cookieName = DEFAULT_THEME_COOKIE): string {
  if (!COOKIE_NAME.test(cookieName)) {
    throw new TypeError(`Invalid theme cookie name: ${JSON.stringify(cookieName)}`);
  }
  return cookieName;
}

function getCookieValues(cookieValues: ThemeCookieValues = DEFAULT_THEME_COOKIE_VALUES): ThemeCookieValues {
  const { light, dark } = cookieValues;
  for (const value of [light, dark]) {
    if (!COOKIE_VALUE.test(value)) throw new TypeError(`Invalid theme cookie value: ${JSON.stringify(value)}`);
  }
  if (light === dark) throw new TypeError(`The theme cookie values must differ: both are ${JSON.stringify(light)}`);
  return { light, dark };
}
