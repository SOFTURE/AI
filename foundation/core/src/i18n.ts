// Copy and localization (docs/02-module-standard.md §6): every module ships complete `en` and
// `pl` dictionaries, and the app passes partial overrides per locale.

export const LOCALES = ["en", "pl"] as const;

export type Locale = (typeof LOCALES)[number];

/** A dictionary: nested groups of message strings. */
export interface MessageTree {
  readonly [key: string]: string | MessageTree;
}

/** The same shape with every key optional, at every depth. */
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

/** One complete dictionary per locale. */
export type Dictionaries<T extends MessageTree> = Readonly<Record<Locale, T>>;

/** Partial overrides an app passes for some locales. */
export type MessageOverrides<T extends MessageTree> = Partial<Record<Locale, DeepPartial<T>>>;

/** Plural forms named after the `Intl.PluralRules` categories; `other` is the fallback. */
export interface PluralForms {
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
}

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

/**
 * The defaults with the overrides applied, per locale. Only keys the defaults have are taken,
 * and a group is never replaced by a string, so an override cannot break the dictionary shape.
 * Inputs are not mutated.
 */
export function mergeMessages<T extends MessageTree>(
  defaults: Dictionaries<T>,
  overrides: MessageOverrides<T> = {},
): Dictionaries<T> {
  const merged = {} as Record<Locale, T>;
  for (const locale of LOCALES) {
    merged[locale] = mergeTree(defaults[locale], overrides[locale]) as T;
  }
  return merged;
}

/** Fills `{name}` placeholders. A placeholder without a value stays as written. */
export function formatMessage(template: string, params: Readonly<Record<string, string | number>> = {}): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

const pluralRulesByLocale = new Map<Locale, Intl.PluralRules>();

/** The form for `count` under the plural rules of `locale` ("1 file", "2 files"). */
export function selectPlural(locale: Locale, count: number, forms: PluralForms): string {
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
