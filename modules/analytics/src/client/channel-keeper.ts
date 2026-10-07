// The browser's half of the channel tag. The proxy re-tags the navigations it sees, but not every
// Next.js client navigation reaches it with a signal it can trust (Next strips its router headers
// before the proxy runs, and a route served from the router's cache sends no request at all). The
// keeper remembers the last valid tag seen in the address bar and hands back the URL with it when
// a navigation lands without the parameter. Like the proxy, it never stores the tag anywhere.
import { parseChannel } from "../channel-rule.js";
import type { ChannelNormalization } from "../options.js";

/** The channel options as plain values, so a server component can pass them to the browser. */
export interface ChannelRule {
  /** The query parameter that carries the channel. */
  readonly param: string;
  /** The source of the pattern a valid value matches. */
  readonly pattern: string;
  /** The pattern's flags (never `g` or `y`; the options refuse them). */
  readonly flags: string;
  /** The longest value accepted. */
  readonly maxLength: number;
  /** How a raw value is repaired first; `none` when absent. */
  readonly normalize?: ChannelNormalization;
  /**
   * The app's first-party origins (`appOrigin` and `analytics({ origins })`); a link to one of them
   * other than the page's own gets the remembered tag (`tagLink`). None when absent.
   */
  readonly origins?: readonly string[];
}

/**
 * Takes the address bar's href after each navigation and returns the href to show instead (the same
 * URL with the remembered tag), or null to leave it. `tagLink` hands back a link with the tag.
 */
export interface ChannelKeeper {
  (href: string): string | null;
  /**
   * `href` (resolved against the page's `current` href) with the remembered tag, when it is an http(s)
   * link to another of the rule's origins without the parameter; null otherwise. The browser's
   * default referrer policy drops the query from a cross-origin `Referer`, so such a link is the
   * only way the tag reaches the other origin.
   */
  tagLink(href: string, current: string): string | null;
}

/**
 * The keeper for one page's lifetime. A URL with the parameter decides: a valid value is remembered,
 * an invalid one forgets the tag, and neither is touched.
 */
export function createChannelKeeper(rule: ChannelRule): ChannelKeeper {
  const options = { pattern: new RegExp(rule.pattern, rule.flags), maxLength: rule.maxLength, normalize: rule.normalize ?? "none" };
  const origins = new Set(rule.origins ?? []);
  let remembered: string | null = null;
  const keep = (href: string): string | null => {
    if (!URL.canParse(href)) return null;
    const url = new URL(href);
    if (url.searchParams.has(rule.param)) {
      remembered = parseChannel(url.searchParams.get(rule.param), options);
      return null;
    }
    if (remembered === null) return null;
    url.searchParams.set(rule.param, remembered);
    return url.href;
  };
  const tagLink = (href: string, current: string): string | null => {
    if (remembered === null || !URL.canParse(current) || !URL.canParse(href, current)) return null;
    const page = new URL(current);
    const link = new URL(href, page);
    if (link.protocol !== "http:" && link.protocol !== "https:") return null;
    if (link.origin === page.origin || !origins.has(link.origin) || link.searchParams.has(rule.param)) return null;
    link.searchParams.set(rule.param, remembered);
    return link.href;
  };
  return Object.assign(keep, { tagLink });
}
