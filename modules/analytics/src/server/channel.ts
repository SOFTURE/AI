// The channel tag: a query parameter on first-party URLs, never a cookie. A page reads its own
// URL; a request that has none of its own (a server action, the next page) reads the page it came
// from through `Referer`, but only from one of this app's origins (`appOrigin` and `analytics({ origins })`).
import type { SoftureConfig } from "@softure-ai/core";
import { parseChannel } from "../channel-rule.js";
import type { ChannelFromReferer } from "../options.js";
import { getChannelOptions, getFirstPartyOrigins } from "./options.js";

export { getFirstPartyOrigins, parseChannel };

/** Where a request's channel can come from. */
export interface ChannelSources {
  /** The request's own URL. When it has the parameter, its value decides, valid or not. */
  readonly url?: string | URL | null;
  /** The `Referer` header; used only when the URL has no parameter and it is same-origin. */
  readonly referer?: string | null;
  /** The `Host` header, for a `Referer` check when there is no request URL (server actions). */
  readonly host?: string | null;
}


/**
 * The first-party origin a request was sent to, read from `Host` (the request URL's host without one):
 * behind a proxy `request.url` names the server's own host and port, not the public one. `Host` only
 * selects among the configured origins; when two share the host, the one whose scheme the first
 * `X-Forwarded-Proto` value names wins, else the first. Null for a host that is not configured.
 */
export function readPublicOrigin(config: SoftureConfig, request: Request): string | null {
  const host = (request.headers.get("host") ?? new URL(request.url).host).toLowerCase();
  const candidates = getFirstPartyOrigins(config).filter((origin) => new URL(origin).host === host);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return candidates.find((origin) => new URL(origin).protocol === `${proto ?? ""}:`) ?? candidates[0] ?? null;
}

/** The channel of a request: its URL's parameter, else the one on the first-party page it came from. */
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
 * Whether `target` belongs to this app: `appOrigin` or one of `analytics({ origins })`, the request's
 * own origin (behind a proxy it can differ from all of them), or, without a request URL, the
 * request's `Host` on http(s).
 */
export function isFirstParty(target: URL, context: FirstPartyContext): boolean {
  if (target.protocol !== "http:" && target.protocol !== "https:") return false;
  if (getFirstPartyOrigins(context.config).includes(target.origin)) return true;
  if (context.url !== null) return target.origin === context.url.origin;
  return context.host !== null && target.host === context.host.toLowerCase();
}

/** A `channelFromReferer` hook and the option name its failures are logged under. */
export interface DerivedChannelSource {
  readonly hook: ChannelFromReferer | undefined;
  readonly label: string;
}

/**
 * The channel a `channelFromReferer` hook derives from an untagged page; its answer passes the
 * channel rule. A throw is logged and gives no channel: the app's hook must not stop a request.
 */
export function deriveChannel(config: SoftureConfig, source: DerivedChannelSource, page: URL): string | null {
  if (source.hook === undefined) return null;
  try {
    return parseChannel(source.hook(new URL(page)), getChannelOptions(config));
  } catch (error) {
    console.error(`@softure-ai/analytics: ${source.label} failed: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function toUrl(value: string | URL | null | undefined): URL | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof URL) return value;
  return URL.canParse(value) ? new URL(value) : null;
}
