import type { ErrorCode, Locale } from "@softure-ai/core";
import { en, type AppMessages } from "./en.ts";
import { pl } from "./pl.ts";

const DICTIONARIES: Readonly<Record<Locale, AppMessages>> = { en, pl };

export type { AppMessages };

export function getMessages(locale: Locale): AppMessages {
  return DICTIONARIES[locale];
}

/** The copy for an error code; an unknown code reads as the generic failure. */
export function getErrorMessage(messages: AppMessages, code: ErrorCode): string {
  const errors: Readonly<Record<string, string>> = messages.errors;
  return errors[code] ?? messages.errors["core.unexpected"];
}
