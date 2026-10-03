// The browser's half of the channel tag. The proxy re-tags the navigations it sees, but not every
// Next.js client navigation reaches it with a signal it can trust (Next strips its router headers
// before the proxy runs, and a route served from the router's cache sends no request at all). The
// keeper remembers the last valid tag seen in the address bar and hands back the URL with it when
// a navigation lands without the parameter. Like the proxy, it never stores the tag anywhere.
import { parseChannel } from "../channel-rule.js";

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
}

/**
 * A function that takes the address bar's href after each navigation and returns the href to show
 * instead (the same URL with the remembered tag), or null to leave it. A URL with the parameter
 * decides: a valid value is remembered, an invalid one forgets the tag, and neither is touched.
 */
export function createChannelKeeper(rule: ChannelRule): (href: string) => string | null {
  const options = { pattern: new RegExp(rule.pattern, rule.flags), maxLength: rule.maxLength };
  let remembered: string | null = null;
  return (href) => {
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
}
