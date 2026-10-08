// The channel piece for the app's `proxy.ts`. Like auth's guard it uses only Web `Request` and
// `Response`, imports nothing from Next, and never reads or writes a cookie: the tag stays in
// first-party URLs. It chains after other pieces:
//
//   return channels.carry(request, guard(request)) ?? channels.tag(request) ?? NextResponse.next();
//
// `carry` adds the tag to a first-party redirect another piece answered with (the auth guard's
// redirect to login), `tag` puts it back on a navigation that came from a tagged page.
//
// Behind a proxy `request.url` carries the server's own host. The public origin comes from `Host`
// (`readPublicOrigin`), and only when it is `appOrigin` or one of `analytics({ origins })`. Without a
// proxy (a dev server on `localhost:<port>`) `Host` is the request URL's own host, and `tag` stays there.
import type { SoftureConfig } from "@softure-ai/core";
import type { ChannelFromReferer } from "../options.js";
import { deriveChannel, hasChannelParam, isFirstParty, readChannel, readPublicOrigin, withChannel } from "../server/channel.js";
import { getChannelOptions } from "../server/options.js";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface ChannelTagger {
  /**
   * `response` with the request's channel added to its `Location` when it is a first-party
   * redirect without one (a relative `Location` stays relative); any other response unchanged,
   * and null for null (no piece answered).
   */
  carry(request: Request, response: Response | null | undefined): Response | null;
  /**
   * A 307 to the same URL with the channel, for a GET navigation (`isNavigation`) without the parameter
   * that comes from a first-party page with a valid one and whose path `targets` accepts; null otherwise
   * (the request goes on). The target is on the origin the request was sent to when it is configured or
   * is the request URL's own host, else on `appOrigin`.
   */
  tag(request: Request): Response | null;
}

export interface ChannelTaggerOptions {
  /**
   * The channel of a navigation from a first-party page without the parameter, derived from that
   * page's URL: `(page) => (page.pathname.startsWith("/blog/") ? "blog" : null)`, usually the same
   * function as `funnel.channelFromReferer`. Its answer passes the channel rule; a throw is logged and
   * tags nothing. A page that has the parameter decides, valid or not.
   */
  readonly channelFromReferer?: ChannelFromReferer;
  /**
   * The navigations `tag` may redirect; without it, every one. A list of absolute pathnames
   * (`["/register"]`) compared exactly with the target's `pathname`, or a predicate over the target and
   * the page the visitor came from; only `true` tags, and a throw is logged and tags nothing.
   * `carry` is not scoped: it adds no request.
   */
  readonly targets?: ChannelTargets;
}

/** The target of a navigation `tag` would redirect and the first-party page it came from. */
export interface ChannelTargetContext {
  readonly target: URL;
  readonly source: URL;
}

/** Pathnames, or a predicate, naming the navigations `tag` may redirect. */
export type ChannelTargets = readonly string[] | ((context: ChannelTargetContext) => boolean);

const TARGETS_LABEL = "channelTagger.targets";

/** The channel piece for `proxy.ts`; reads `analytics({ channel, origins })` once. */
export function createChannelTagger(config: SoftureConfig, options: ChannelTaggerOptions = {}): ChannelTagger {
  // Fails at startup, not on the first request, when the module is not enabled.
  const { param } = getChannelOptions(config);
  const isTarget = createTargetCheck(options.targets);

  /** The request's channel: its own parameter, the tagged page it came from, or the hook on that page. */
  const readRequestChannel = (request: Request, url: URL): string | null => {
    const referer = request.headers.get("referer");
    const channel = readChannel(config, { url, referer });
    if (channel !== null || options.channelFromReferer === undefined || url.searchParams.has(param)) return channel;
    if (referer === null || !URL.canParse(referer)) return null;
    const page = new URL(referer);
    if (page.searchParams.has(param) || !isFirstParty(page, { config, url, host: null })) return null;
    return deriveChannel(config, { hook: options.channelFromReferer, label: "channelFromReferer" }, page);
  };

  return {
    carry(request, response) {
      if (response === null || response === undefined) return null;
      const location = response.headers.get("location");
      if (!REDIRECT_STATUSES.has(response.status) || location === null) return response;
      const url = new URL(request.url);
      if (!URL.canParse(location, url)) return response;
      const target = new URL(location, url);
      if (!isFirstParty(target, { config, url, host: null }) || hasChannelParam(config, target)) return response;
      const channel = readRequestChannel(request, url);
      if (channel === null) return response;
      const tagged = withChannel(config, target, channel);
      // A relative Location resolves in the browser against the public URL; resolved here it would
      // name the server's internal host.
      const headers = new Headers(response.headers);
      headers.set("location", isRelative(location) ? `${tagged.pathname}${tagged.search}${tagged.hash}` : tagged.href);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    },

    tag(request) {
      if (!isNavigation(request)) return null;
      const url = new URL(request.url);
      if (hasChannelParam(config, url)) return null;
      const channel = readRequestChannel(request, url);
      // A channel came from the Referer, so the header is a valid URL here.
      if (channel === null || !isTarget(url, new URL(request.headers.get("referer") ?? url))) return null;
      // Built on the public origin (else appOrigin, as auth's guard does): behind a proxy the request
      // URL carries an internal host. The path is set, not parsed against the origin:
      // `//elsewhere.example` would leave it.
      const target = new URL(readPublicOrigin(config, request) ?? readOwnOrigin(request, url) ?? config.appOrigin);
      target.pathname = url.pathname;
      target.search = url.search;
      return Response.redirect(withChannel(config, target, channel), 307);
    },
  };
}

/** The check `targets` describes; every target passes without it. Throws at startup on a bad list. */
function createTargetCheck(targets: ChannelTargets | undefined): (target: URL, source: URL) => boolean {
  if (targets === undefined) return () => true;
  if (typeof targets === "function") {
    return (target, source) => {
      try {
        return targets({ target: new URL(target), source: new URL(source) }) === true;
      } catch (error) {
        console.error(`@softure-ai/analytics: ${TARGETS_LABEL} failed: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    };
  }
  if (!Array.isArray(targets)) throw new Error(`@softure-ai/analytics: ${TARGETS_LABEL} must be a list of pathnames or a function`);
  if (targets.length === 0) throw new Error(`@softure-ai/analytics: ${TARGETS_LABEL} must name at least one path`);
  const paths = new Set(targets.map(toPathname));
  return (target) => paths.has(target.pathname);
}

/** `path` as `URL.pathname` spells it (percent-encoded); throws for anything but an absolute pathname. */
function toPathname(path: unknown): string {
  const valid = typeof path === "string" && path.startsWith("/") && !/^[/\\]{2}|[?#]/.test(path);
  if (!valid) throw new Error(`@softure-ai/analytics: ${TARGETS_LABEL}: ${JSON.stringify(path)} is not an absolute pathname`);
  return new URL(path, "http://localhost").pathname;
}

/**
 * The request URL's own origin when `Host` names it, i.e. no proxy rewrote the host. The scheme comes
 * from the first `X-Forwarded-Proto` value when it is http(s): a TLS proxy in front sends `https`.
 * Null when `Host` is missing or names another host.
 */
function readOwnOrigin(request: Request, url: URL): string | null {
  const host = request.headers.get("host")?.toLowerCase();
  if (host === undefined || host !== url.host) return null;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return `${proto === "http" || proto === "https" ? proto : url.protocol.slice(0, -1)}://${url.host}`;
}

/** A Location without a scheme or host (`/login`, `login`, `?x`), which the browser resolves itself. */
function isRelative(location: string): boolean {
  // Browsers read a backslash as a slash in http(s) URLs, so `/\host` means `//host`.
  return !/^[a-z][a-z0-9+.-]*:/i.test(location) && !location.replaceAll("\\", "/").startsWith("//");
}

/**
 * A page load the address bar will show: a browser navigation (`Sec-Fetch-Mode: navigate`), or a
 * Next.js client navigation or prefetch, whose router follows the redirect and shows the final URL.
 * Next strips its `RSC` header (and the `_rsc` parameter) before the proxy runs, so a client
 * navigation is recognised by the `Next-Url` header its router sends, on a request that is not a
 * subresource (`Sec-Fetch-Dest: empty`). `RSC: 1` still counts where Next leaves it in.
 * Other fetches, images, beacons and server actions (POST) are left alone.
 */
export function isNavigation(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const headers = request.headers;
  if (headers.get("sec-fetch-mode") === "navigate" || headers.get("rsc") === "1") return true;
  const destination = headers.get("sec-fetch-dest");
  return headers.has("next-url") && (destination === null || destination === "empty");
}
