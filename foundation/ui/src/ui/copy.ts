import { type DeepPartial, type Locale, type MessageTree, mergeMessages, selectMessages } from "@softure-ai/core";
import { type UiMessages, uiMessages } from "../messages/index.js";

/** The copy props every component with built-in text accepts. */
export interface CopyProps<Group extends keyof UiMessages> {
  /** Locale of the built-in copy; `en` by default. */
  readonly locale?: Locale;
  /** Partial copy overrides, or the app's own translation, for the current locale. */
  readonly messages?: DeepPartial<UiMessages[Group]>;
}

/** One message group of the package in `locale`, with the app's partial overrides applied. */
export function getCopy<Group extends keyof UiMessages>(
  group: Group,
  { locale = "en", messages }: CopyProps<Group>,
): UiMessages[Group] {
  const defaults = { en: uiMessages.en[group] };
  return selectMessages(mergeMessages(defaults, { [locale]: messages }), locale);
}

/** Two partial overrides of one message group as one; `top` wins key by key, at every depth. */
export function mergeCopyOverrides<Group extends MessageTree>(
  base: DeepPartial<Group> | undefined,
  top: DeepPartial<Group> | undefined,
): DeepPartial<Group> | undefined {
  if (base === undefined) return top;
  if (top === undefined) return base;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(top) as [string, unknown][]) {
    const current = merged[key];
    merged[key] =
      typeof value === "object" && value !== null && typeof current === "object" && current !== null
        ? mergeCopyOverrides(current as DeepPartial<MessageTree>, value as DeepPartial<MessageTree>)
        : value;
  }
  return merged as DeepPartial<Group>;
}
