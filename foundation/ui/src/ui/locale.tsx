"use client";

import type { DeepPartial, Locale } from "@softure-ai/core";
import { createContext, type ReactNode, useContext } from "react";
import type { UiMessages } from "../messages/index.js";
import { type CopyProps, mergeCopyOverrides } from "./copy.js";

// The app-wide locale and translation of the built-in copy. A component's own `locale` prop wins, then the nearest
// provider, then `en`; its own `messages` win key by key over the provider's. Context reaches client components
// only, so the server-safe components (Card, Field) render their localised parts through small client components
// that read it.

interface UiLocaleValue {
  readonly locale?: Locale;
  readonly messages?: DeepPartial<UiMessages>;
}

const UiLocaleContext = createContext<UiLocaleValue>({});

export interface UiLocaleProviderProps {
  /** The locale of the built-in copy and the number notation; `en` when left out. */
  readonly locale?: Locale;
  /** The app's own translation of the built-in copy, per message group, over the locale's dictionary. */
  readonly messages?: DeepPartial<UiMessages>;
  readonly children?: ReactNode;
}

/** Sets the locale and the copy of every `@softure-ai/ui` component below it that is not given its own. */
export function UiLocaleProvider({ locale, messages, children }: UiLocaleProviderProps) {
  return <UiLocaleContext value={{ locale, messages }}>{children}</UiLocaleContext>;
}

/** The locale a component uses: its own prop, else the provider's, else `en`. */
export function useUiLocale(explicit?: Locale): Locale {
  const provided = useContext(UiLocaleContext);
  return explicit ?? provided.locale ?? "en";
}

/** A component's copy props with the provider's locale and translation filled in. */
export function useUiCopyProps<Group extends keyof UiMessages>(group: Group, { locale, messages }: CopyProps<Group>): CopyProps<Group> {
  const provided = useContext(UiLocaleContext);
  // Every group is an object, so `DeepPartial<UiMessages>[Group]` is `DeepPartial<UiMessages[Group]>`; TypeScript
  // cannot resolve the conditional type for a generic key.
  const providedGroup = provided.messages?.[group] as DeepPartial<UiMessages[Group]> | undefined;
  return { locale: locale ?? provided.locale ?? "en", messages: mergeCopyOverrides(providedGroup, messages) };
}
