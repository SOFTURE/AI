// The channel tag: a query parameter on first-party URLs, never a cookie. A page reads its own
// URL; a request that has none of its own (a server action, the next page) reads the page it came
// from through `Referer`, but only from this app's origin.
import type { SoftureConfig } from "@softure-ai/core";
import { parseChannel } from "../channel-rule.js";
import { getChannelOptions } from "./options.js";

export { parseChannel };

/** Where a request's channel can come from. */
export interface ChannelSources {
  /** The request's own URL. When it has the parameter, its value decides, valid or not. */
  readonly url?: string | URL | null;
  /** The `Referer` header; used only when the URL has no parameter and it is same-origin. */
  readonly referer?: string | null;
  /** The `Host` header, for a `Referer` check when there is no request URL (server actions). */
  readonly host?: string | null;
}


/** The channel of a request: its URL's parameter, else the one on the same-origin page it came from. */
export function readChannel(config: SoftureConfig, sources: ChannelSources): string | null {
  const options = getChannelOptions(config);
  const url = toUrl(sources.url);
  if (url?.searchParams.has(options.param)) return parseChannel(url.searchParams.get(options.param), options);
  const referer = toUrl(sources.referer);
  if (referer === null || !isFirstParty(referer, { config, url, host: sources.host ?? null })) return null;
  return parseChannel(referer.searchParams.get(options.param), options);
}

/** Whether `url` already carries the channel parameter (with any value). */
export function hasChannelParam(config: SoftureConfig, url: URL): boolean {
  return url.searchParams.has(getChannelOptions(config).param);
}

/** A copy of `url` with the channel parameter set to `channel`. */
export function withChannel(config: SoftureConfig, url: URL, channel: string): URL {
  const tagged = new URL(url);
  tagged.searchParams.set(getChannelOptions(config).param, channel);
  return tagged;
}

/**
 * `path` with the channel parameter set to `channel`, for a redirect inside the app: only a path
 * that starts with a single `/` is tagged, and one that already carries the parameter (with any
 * value) is left as it is. Anything else comes back unchanged.
 */
export function tagPath(config: SoftureConfig, path: string, channel: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return path;
  const origin = new URL(config.appOrigin).origin;
  const url = new URL(path, origin);
  if (url.origin !== origin || hasChannelParam(config, url)) return path;
  const tagged = withChannel(config, url, channel);
  return `${tagged.pathname}${tagged.search}${tagged.hash}`;
}

interface FirstPartyContext {
  readonly config: SoftureConfig;
  readonly url: URL | null;
  readonly host: string | null;
}

/**
 * Whether `target` belongs to this app: the configured `appOrigin`, the request's own origin (behind
 * a proxy the two can differ), or, without a request URL, the request's `Host` on http(s).
 */
export function isFirstParty(target: URL, context: FirstPartyContext): boolean {
  if (target.protocol !== "http:" && target.protocol !== "https:") return false;
  if (target.origin === new URL(context.config.appOrigin).origin) return true;
  if (context.url !== null) return target.origin === context.url.origin;
  return context.host !== null && target.host === context.host.toLowerCase();
}

function toUrl(value: string | URL | null | undefined): URL | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof URL) return value;
  return URL.canParse(value) ? new URL(value) : null;
}
