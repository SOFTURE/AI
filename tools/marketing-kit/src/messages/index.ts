import { en } from "./en.js";

/** The built-in copy that ends up in a film or a post: English, the only built-in language. */
export const marketingMessages = { en };

export type MarketingMessages = typeof en;

/** The same shape with every key optional: `brand.messages`, an app's own translation or changed English copy. */
export type MarketingMessageOverrides = {
  readonly [Group in keyof MarketingMessages]?: {
    readonly [Key in keyof MarketingMessages[Group]]?: MarketingMessages[Group][Key] extends string
      ? string
      : { readonly [Leaf in keyof MarketingMessages[Group][Key]]?: string };
  };
};

/** The English copy with the app's overrides applied; a key the overrides leave out reads English. */
export function getMarketingMessages(overrides: MarketingMessageOverrides = {}): MarketingMessages {
  return {
    posts: { ...en.posts, ...overrides.posts, platforms: { ...en.posts.platforms, ...overrides.posts?.platforms } },
    film: { ...en.film, ...overrides.film },
  };
}

/** Replaces every `{name}` in `template` with its value; an unknown placeholder is a bug, so it throws. */
export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (placeholder, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`formatMessage: no value for ${placeholder} in "${template}".`);
    return String(value);
  });
}
