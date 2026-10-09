// The public origin of a request, one rule for every module (issue #311). Behind a proxy `request.url` names the
// server's own listening address (`http://0.0.0.0:3000`), so the origin is read from headers: the scheme from the
// first `X-Forwarded-Proto` value when it is http or https, the host from `Host`. `X-Forwarded-Host` is read only
// where a list of the app's origins gates the result: a client can send it through a proxy that keeps it.
import type { SoftureConfig } from "./config.js";

/** What the origin helpers read from a request: a Web `Request`, or Next's `headers()` with a URL. */
export interface OriginRequest {
  readonly url: string;
  readonly headers: { get(name: string): string | null };
}

export interface ReadOriginOptions {
  /** Read the first `X-Forwarded-Host` value before `Host`. Only for a result checked against a list of origins. */
  readonly forwardedHost?: boolean;
}

export interface ResolveAppOriginOptions {
  /** Origins trusted besides `appOrigin` and `config.origins.trustedOrigins`, e.g. a module's own option. */
  readonly trustedOrigins?: readonly string[];
}

/**
 * The normalized origin (`https://example.com`) when `value` is exactly `http(s)://host[:port]`, a trailing `/`
 * allowed; null for anything else: a path, query, fragment, credentials, spaces or another scheme.
 */
export function parseOrigin(value: string): string | null {
  const candidate = value.endsWith("/") ? value.slice(0, -1) : value;
  // Checked on the raw text: `new URL` alone would accept and drop a path, a query or credentials.
  if (!/^https?:\/\/[^/\\?#@\s]+$/i.test(candidate)) return null;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

/**
 * The host the request was sent to: the first `X-Forwarded-Host` value when `forwardedHost` is set, else the first
 * `Host` value, else the URL's host; trimmed and lowercased.
 */
export function readRequestHost(request: OriginRequest, options: ReadOriginOptions = {}): string {
  const forwarded = options.forwardedHost === true ? readFirstValue(request.headers.get("x-forwarded-host")) : null;
  return forwarded ?? readFirstValue(request.headers.get("host")) ?? new URL(request.url).host;
}

/** The first `X-Forwarded-Proto` value when it is `http` or `https` (any case), else null. */
export function readForwardedProto(request: OriginRequest): "http" | "https" | null {
  const proto = readFirstValue(request.headers.get("x-forwarded-proto"));
  return proto === "http" || proto === "https" ? proto : null;
}

/**
 * The origin the request was sent to: the first `X-Forwarded-Proto` value when it is http or https (else the URL's
 * scheme) and `readRequestHost`. Null when the host is no host (a path, credentials or spaces in the header).
 */
export function readRequestOrigin(request: OriginRequest, options: ReadOriginOptions = {}): string | null {
  const scheme = readForwardedProto(request) ?? new URL(request.url).protocol.slice(0, -1);
  return parseOrigin(`${scheme}://${readRequestHost(request, options)}`);
}

/**
 * Every origin the app is served under: `appOrigin`, `config.origins.trustedOrigins`, then `extra`, without
 * repeats. An `extra` entry that is not an http(s) origin is a setup bug and throws by name.
 */
export function getTrustedOrigins(config: SoftureConfig, extra: readonly string[] = []): readonly string[] {
  const listed = extra.map((entry) => {
    const origin = parseOrigin(entry);
    if (origin === null) throw new Error(`@softure-ai/core: trusted origin "${entry.slice(0, 100)}" must be an http(s) origin such as https://example.com`);
    return origin;
  });
  return [...new Set([config.appOrigin, ...config.origins.trustedOrigins, ...listed])];
}

/**
 * The app origin to build absolute URLs on for `request`:
 * 1. the request's origin, read with `X-Forwarded-Host`, when it is one of `getTrustedOrigins`;
 * 2. else, with `config.origins.trustRequestHost`, the request's origin read from `Host` (an image built once and
 *    served under other origins, behind a proxy that passes `Host` through and refuses hosts it does not serve);
 * 3. else `config.appOrigin`.
 */
export function resolveAppOrigin(config: SoftureConfig, request: OriginRequest, options: ResolveAppOriginOptions = {}): string {
  const forwarded = readRequestOrigin(request, { forwardedHost: true });
  if (forwarded !== null && getTrustedOrigins(config, options.trustedOrigins).includes(forwarded)) return forwarded;
  const requested = config.origins.trustRequestHost ? readRequestOrigin(request) : null;
  return requested ?? config.appOrigin;
}

function readFirstValue(header: string | null): string | null {
  const value = header?.split(",")[0]?.trim().toLowerCase();
  return value === undefined || value === "" ? null : value;
}
