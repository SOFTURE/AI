import { formatMessage, type ErrorCode, type Locale } from "@softure-ai/core";
import { GUESTBOOK_MESSAGE_MAX_LENGTH } from "../modules/guestbook/limits.ts";
import { en, type AppMessages } from "./en.ts";

const DICTIONARIES: Readonly<Record<Locale, AppMessages | undefined>> = { en };

export type { AppMessages };

/** The app's copy in `locale`: English, its only language, for any locale. */
export function getMessages(locale: Locale): AppMessages {
  return DICTIONARIES[locale] ?? en;
}

/** The copy for an error code, limits filled in; an unknown code reads as the generic failure. */
export function getErrorMessage(messages: AppMessages, code: ErrorCode): string {
  const errors: Readonly<Record<string, string>> = messages.errors;
  return formatMessage(errors[code] ?? messages.errors["core.unexpected"], { max: GUESTBOOK_MESSAGE_MAX_LENGTH });
}
