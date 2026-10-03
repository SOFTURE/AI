// The channel piece for the app's `proxy.ts`. Like auth's guard it uses only Web `Request` and
// `Response`, imports nothing from Next, and never reads or writes a cookie: the tag stays in
// first-party URLs. It chains after other pieces:
//
//   return channels.carry(request, guard(request)) ?? channels.tag(request) ?? NextResponse.next();
//
// `carry` adds the tag to a same-origin redirect another piece answered with (the auth guard's
// redirect to login), `tag` puts it back on a navigation that came from a tagged page.
import type { SoftureConfig } from "@softure-ai/core";
import { hasChannelParam, isFirstParty, readChannel, withChannel } from "../server/channel.js";
import { getChannelOptions } from "../server/options.js";

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export interface ChannelTagger {
  /**
   * `response` with the request's channel added to its `Location` when it is a same-origin
   * redirect without one; any other response unchanged, and null for null (no piece answered).
   */
  carry(request: Request, response: Response | null | undefined): Response | null;
  /**
   * A 307 to the same URL with the channel, for a GET navigation without the parameter that comes
   * from a same-origin page with a valid one; null otherwise (the request goes on).
   */
  tag(request: Request): Response | null;
}

/** The channel piece for `proxy.ts`; reads `analytics({ channel })` once. */
export function createChannelTagger(config: SoftureConfig): ChannelTagger {
  // Fails at startup, not on the first request, when the module is not enabled.
  getChannelOptions(config);

  return {
    carry(request, response) {
      if (response === null || response === undefined) return null;
      const location = response.headers.get("location");
      if (!REDIRECT_STATUSES.has(response.status) || location === null) return response;
      const url = new URL(request.url);
      if (!URL.canParse(location, url)) return response;
      const target = new URL(location, url);
      if (!isFirstParty(target, { config, url, host: null }) || hasChannelParam(config, target)) return response;
      const channel = readChannel(config, { url, referer: request.headers.get("referer") });
      if (channel === null) return response;
      const headers = new Headers(response.headers);
      headers.set("location", withChannel(config, target, channel).href);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    },

    tag(request) {
      if (!isNavigation(request)) return null;
      const url = new URL(request.url);
      if (hasChannelParam(config, url)) return null;
      const channel = readChannel(config, { url, referer: request.headers.get("referer") });
      if (channel === null) return null;
      // Built on appOrigin, as auth's guard does: behind a proxy the request URL may carry an internal
      // host. The path is set, not parsed against the origin: `//elsewhere.example` would leave it.
      const target = new URL(config.appOrigin);
      target.pathname = url.pathname;
      target.search = url.search;
      return Response.redirect(withChannel(config, target, channel), 307);
    },
  };
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
