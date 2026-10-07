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
// (`readPublicOrigin`), and only when it is `appOrigin` or one of `analytics({ origins })`.
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
   * A 307 to the same URL with the channel, for a GET navigation without the parameter that comes
   * from a first-party page with a valid one; null otherwise (the request goes on). The target is on
   * the origin the request was sent to when it is configured, else on `appOrigin`.
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
}

/** The channel piece for `proxy.ts`; reads `analytics({ channel, origins })` once. */
export function createChannelTagger(config: SoftureConfig, options: ChannelTaggerOptions = {}): ChannelTagger {
  // Fails at startup, not on the first request, when the module is not enabled.
  const { param } = getChannelOptions(config);

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
      if (channel === null) return null;
      // Built on the public origin (else appOrigin, as auth's guard does): behind a proxy the request
      // URL carries an internal host. The path is set, not parsed against the origin:
      // `//elsewhere.example` would leave it.
      const target = new URL(readPublicOrigin(config, request) ?? config.appOrigin);
      target.pathname = url.pathname;
      target.search = url.search;
      return Response.redirect(withChannel(config, target, channel), 307);
    },
  };
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
function isNavigation(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const headers = request.headers;
  if (headers.get("sec-fetch-mode") === "navigate" || headers.get("rsc") === "1") return true;
  const destination = headers.get("sec-fetch-dest");
  return headers.has("next-url") && (destination === null || destination === "empty");
}
