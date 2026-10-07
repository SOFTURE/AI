"use client";

import type { DeepPartial, Locale } from "@softure-ai/core";
import { useState, useSyncExternalStore } from "react";
import type { UiMessages } from "../messages/index.js";
import { applyThemeChoice, getThemeCookieDomain, parseThemeCookie, THEME_CHOICES, type ThemeChoice, type ThemeCookieValues } from "../theme/theme-cookie.js";
import { resolveTheme } from "../theme/resolve-theme.js";
import { getThemeColors } from "../theme/theme-css.js";
import type { SoftureTheme } from "../theme/tokens.js";
import type { ClassNames } from "./class-names.js";
import { getCopy } from "./copy.js";
import { SegmentedControl, type SegmentedControlSlot } from "./segmented-control.js";
import { useUiLocale } from "./locale.js";

export type ThemeSwitchSlot = SegmentedControlSlot;

export interface ThemeSwitchProps {
  readonly locale?: Locale;
  /** Partial copy overrides for the current locale. */
  readonly messages?: DeepPartial<UiMessages["themeSwitch"]>;
  readonly classNames?: ClassNames<ThemeSwitchSlot>;
  /** Render structure and behaviour only; the app styles every slot. */
  readonly unstyled?: boolean;
  readonly cookieName?: string;
  /** The values stored for each choice; `{ light: "light", dark: "dark" }` by default. */
  readonly cookieValues?: ThemeCookieValues;
  /**
   * Cookie `Domain`, to share the choice across subdomains: a fixed domain; a function of the current hostname,
   * called on each change (`null` or `undefined` keeps the cookie host-only); or `{ apex }`, resolved with
   * `getThemeCookieDomain`, the form a server component can pass (a function cannot cross to the client).
   */
  readonly cookieDomain?: ThemeCookieDomain;
  /** The theme in use, for the browser bar colour. */
  readonly theme?: SoftureTheme;
  /** The `design.json` value given to `SoftureThemeProvider`, applied before `theme`. */
  readonly design?: unknown;
  readonly onChange?: (choice: ThemeChoice) => void;
}

/** Where the theme cookie is shared: a domain, a function of the hostname, or an apex to share with its subdomains. */
export type ThemeCookieDomain = string | ((hostname: string) => string | null | undefined) | { readonly apex: string };

/** The cookie domain for the page's current host. */
function resolveCookieDomain(cookieDomain: ThemeCookieDomain | undefined, hostname: string): string | null | undefined {
  if (cookieDomain === undefined || typeof cookieDomain === "string") return cookieDomain;
  if (typeof cookieDomain === "function") return cookieDomain(hostname);
  return getThemeCookieDomain(hostname, cookieDomain.apex);
}

function subscribeNever(): () => void {
  return () => undefined;
}

function getServerChoice(): ThemeChoice {
  return "system";
}

/**
 * Light · Dark · System, a `SegmentedControl` (a native radio group: arrow keys move the choice). The choice applies at
 * once, without a reload, and survives reloads through the cookie read by `ThemeScript`. The server
 * renders "System"; the browser reads the cookie after hydration. The page theme itself does not
 * wait for hydration: the boot script has set it already.
 */
export function ThemeSwitch({
  locale,
  messages,
  classNames,
  unstyled,
  cookieName,
  cookieValues,
  cookieDomain,
  theme,
  design,
  onChange,
}: ThemeSwitchProps) {
  const cookieChoice = useSyncExternalStore(
    subscribeNever,
    () => parseThemeCookie(document.cookie, { cookieName, cookieValues }),
    getServerChoice,
  );
  const [picked, setPicked] = useState<ThemeChoice | null>(null);
  const choice = picked ?? cookieChoice;
  const copy = getCopy("themeSwitch", { locale: useUiLocale(locale), messages });
  function handleChange(next: ThemeChoice) {
    applyThemeChoice(next, {
      cookieName,
      cookieValues,
      domain: resolveCookieDomain(cookieDomain, window.location.hostname),
      themeColors: getThemeColors(resolveTheme({ theme, design }, "ThemeSwitch")),
    });
    setPicked(next);
    onChange?.(next);
  }

  return (
    <SegmentedControl
      options={THEME_CHOICES.map((option) => ({ value: option, label: copy[option] }))}
      value={choice}
      onChange={handleChange}
      legend={copy.legend}
      classNames={classNames}
      unstyled={unstyled}
    />
  );
}
