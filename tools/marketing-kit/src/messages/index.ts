import { en } from "./en.js";
import { pl } from "./pl.js";

/** Complete default dictionaries of the copy that ends up in a film or a post. */
export const marketingMessages = { en, pl };

export type MarketingLocale = keyof typeof marketingMessages;

export type MarketingMessages = typeof en;

export const MARKETING_LOCALES = Object.keys(marketingMessages) as MarketingLocale[];

export function getMarketingMessages(locale: MarketingLocale): MarketingMessages {
  return marketingMessages[locale];
}

/** Replaces every `{name}` in `template` with its value; an unknown placeholder is a bug, so it throws. */
export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (placeholder, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`formatMessage: no value for ${placeholder} in "${template}".`);
    return String(value);
  });
}
