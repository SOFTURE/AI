// Copy and localization (docs/02-module-standard.md §6): every module ships a complete `en`
// dictionary, the only built-in language. An app that shows another language passes its own
// translation as overrides for its locale; a key it leaves out reads English.

/** A BCP 47 language tag (`en`, `de-AT`). */
export type Locale = string;

/** The language of every built-in dictionary and the fallback for any other locale. */
export const DEFAULT_LOCALE = "en";

/** A dictionary: nested groups of message strings. */
export interface MessageTree {
  readonly [key: string]: string | MessageTree;
}

/** The same shape with every key optional, at every depth. */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

/** A complete `en` dictionary, plus complete dictionaries for any other locales. */
export type Dictionaries<T extends MessageTree> = { readonly en: T } & { readonly [locale: string]: T | undefined };

/** Partial overrides an app passes per locale: a translation for its own locale, or changed English copy. */
export type MessageOverrides<T extends MessageTree> = { readonly [locale: string]: DeepPartial<T> | undefined };

/** A text an app writes per locale in its options (a plan name, a label); `en` is the fallback. */
export type LocalizedText = { readonly [locale: string]: string | undefined };

/** Plural forms named after the `Intl.PluralRules` categories; `other` is the fallback. */
export interface PluralForms {
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
}

/** Whether `value` is a well-formed BCP 47 language tag. */
export function isLocale(value: unknown): value is Locale {
  if (typeof value !== "string" || value === "") return false;
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    // RangeError: not a well-formed tag.
    return false;
  }
}

/**
 * The defaults with the overrides applied, per locale: `en` and every locale the defaults or the
 * overrides name. A locale without its own defaults is built on `en`, so a key its override leaves
 * out reads English. Only keys the defaults have are taken, and a group is never replaced by a
 * string, so an override cannot break the dictionary shape. Inputs are not mutated.
 */
export function mergeMessages<T extends MessageTree>(
  defaults: Dictionaries<T>,
  overrides: MessageOverrides<T> = {},
): Dictionaries<T> {
  const merged: Record<string, T> = {};
  for (const locale of new Set([DEFAULT_LOCALE, ...Object.keys(defaults), ...Object.keys(overrides)])) {
    merged[locale] = mergeTree(defaults[locale] ?? defaults.en, overrides[locale]) as T;
  }
  return merged as Dictionaries<T>;
}

/**
 * The dictionary for `locale`: its own, else its language's (`pt-BR` reads `pt`), else `en`.
 */
export function selectMessages<T extends MessageTree>(dictionaries: Dictionaries<T>, locale: Locale): T {
  return dictionaries[locale] ?? dictionaries[getLanguage(locale)] ?? dictionaries.en;
}

/** The text for `locale` with `selectMessages`' fallback order, or `fallback` when no locale has one. */
export function pickLocalizedText(text: LocalizedText | undefined, locale: Locale, fallback = ""): string {
  if (text === undefined) return fallback;
  return text[locale] ?? text[getLanguage(locale)] ?? text.en ?? fallback;
}

function getLanguage(locale: Locale): string {
  return locale.split("-")[0] ?? locale;
}

/** Fills `{name}` placeholders. A placeholder without a value stays as written. */
export function formatMessage(template: string, params: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

const pluralRulesByLocale = new Map<string, Intl.PluralRules>();

/**
 * The form for `count` under the plural rules of `locale`, any BCP 47 tag ("1 file", "2 files"). A category the
 * forms leave out falls back to `other`.
 */
export function selectPlural(locale: string, count: number, forms: PluralForms): string {
  let rules = pluralRulesByLocale.get(locale);
  if (rules === undefined) {
    rules = new Intl.PluralRules(locale);
    pluralRulesByLocale.set(locale, rules);
  }
  return forms[rules.select(count)] ?? forms.other;
}

/** The message at a dotted path (`login.title`), or `undefined` when there is no string there. */
export function getMessage(tree: MessageTree, path: string): string | undefined {
  let node: string | MessageTree | undefined = tree;
  for (const key of path.split(".")) {
    if (typeof node !== "object" || !Object.hasOwn(node, key)) {
      return undefined;
    }
    node = node[key];
  }
  return typeof node === "string" ? node : undefined;
}

function mergeTree(base: MessageTree, override: unknown): MessageTree {
  if (typeof override !== "object" || override === null) {
    return structuredClone(base);
  }

  const result: Record<string, string | MessageTree> = {};
  for (const [key, value] of Object.entries(base)) {
    const next: unknown = Object.hasOwn(override, key) ? (override as Record<string, unknown>)[key] : undefined;
    if (typeof value === "string") {
      result[key] = typeof next === "string" ? next : value;
    } else {
      result[key] = mergeTree(value, next);
    }
  }
  return result;
}
