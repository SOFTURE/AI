"use client";

import type { Locale } from "@softure-ai/core";
import { createContext, type ReactNode, useContext } from "react";

// The app-wide locale of the built-in copy. A component's own `locale` prop wins, then the nearest
// provider, then `en`. Context reaches client components only, so the server-safe components (Card,
// Field) render their localised parts through small client components that read it.

const UiLocaleContext = createContext<Locale | undefined>(undefined);

export interface UiLocaleProviderProps {
  readonly locale: Locale;
  readonly children?: ReactNode;
}

/** Sets the locale of every `@softure-ai/ui` component below it that is not given one. */
export function UiLocaleProvider({ locale, children }: UiLocaleProviderProps) {
  return <UiLocaleContext value={locale}>{children}</UiLocaleContext>;
}

/** The locale a component uses: its own prop, else the provider's, else `en`. */
export function useUiLocale(explicit?: Locale): Locale {
  const provided = useContext(UiLocaleContext);
  return explicit ?? provided ?? "en";
}
