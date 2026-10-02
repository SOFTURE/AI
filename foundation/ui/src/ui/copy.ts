import { type DeepPartial, type Locale, mergeMessages } from "@softure-ai/core";
import { type UiMessages, uiMessages } from "../messages/index.js";

/** The copy props every component with built-in text accepts. */
export interface CopyProps<Group extends keyof UiMessages> {
  /** Locale of the built-in copy; `en` by default. */
  readonly locale?: Locale;
  /** Partial copy overrides for the current locale. */
  readonly messages?: DeepPartial<UiMessages[Group]>;
}

/** One message group of the package in `locale`, with the app's partial overrides applied. */
export function getCopy<Group extends keyof UiMessages>(
  group: Group,
  { locale = "en", messages }: CopyProps<Group>,
): UiMessages[Group] {
  const defaults = { en: uiMessages.en[group], pl: uiMessages.pl[group] };
  return mergeMessages(defaults, { [locale]: messages })[locale];
}
