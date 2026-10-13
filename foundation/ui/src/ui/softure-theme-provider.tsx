import type { DeepPartial, Locale } from "@softure-ai/core";
import type { UiMessages } from "../messages/index.js";
import type { ReactNode } from "react";
import { resolveTheme } from "../theme/resolve-theme.js";
import { buildThemeCss, type SchemeScopes } from "../theme/theme-css.js";
import type { SoftureTheme } from "../theme/tokens.js";
import { UiLocaleProvider } from "./locale.js";

export interface SoftureThemeProviderProps {
  /** Token overrides; tokens it does not name keep their defaults (or the app's CSS). */
  readonly theme?: SoftureTheme;
  /** A `design.json` value (Impeccable, schemaVersion 2), applied before `theme`. */
  readonly design?: unknown;
  /** Selectors that always take one scheme (a dark section of a light page); see `buildThemeCss`. */
  readonly schemeScopes?: SchemeScopes;
  /** The locale of every component's built-in copy below the provider (`UiLocaleProvider`). */
  readonly locale?: Locale;
  /** The app's own translation of the built-in copy below the provider (`UiLocaleProvider`). */
  readonly messages?: DeepPartial<UiMessages>;
  readonly children?: ReactNode;
}

/**
 * Applies a theme to the page: a `<style>` with the overridden tokens, then the children. Works in
 * server components (no state, no effects). The CSS is unlayered, so it beats the defaults in
 * `@layer softure`. An invalid `design` is a configuration bug and throws on the first render.
 */
export function SoftureThemeProvider({ theme, design, schemeScopes, locale, messages, children }: SoftureThemeProviderProps) {
  const css = buildThemeCss(resolveTheme({ theme, design }, "SoftureThemeProvider"), { schemeScopes });
  return (
    <>
      {css === "" ? null : <style data-softure-theme="">{css}</style>}
      {locale === undefined && messages === undefined ? (
        children
      ) : (
        <UiLocaleProvider locale={locale} messages={messages}>
          {children}
        </UiLocaleProvider>
      )}
    </>
  );
}
