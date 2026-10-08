// The origins one request is served under: the app origin every OAuth URL is built from, and the
// other public hosts whose root may be named as a protected resource. Pure: no config, no database.

/** What the origin helpers read from a request: a Web `Request`, or Next's `headers()` with a URL. */
export interface McpOriginRequest {
  readonly url: string;
  readonly headers: { get(name: string): string | null };
}

export interface McpOrigins {
  /** The issuer, and the origin of every endpoint, of `resource_metadata` and of the consent form. */
  readonly appOrigin: string;
  /** Other public hosts (`resourceOrigins`), each a bare origin. */
  readonly resourceOrigins: readonly string[];
}

function firstValue(header: string | null): string | null {
  const value = header?.split(",")[0]?.trim().toLowerCase();
  return value === undefined || value === "" ? null : value;
}

/** The host the request was sent to: `Host`, else the URL's host. Behind a proxy the URL names the server's own. */
export function readRequestHost(request: McpOriginRequest): string {
  return firstValue(request.headers.get("host")) ?? new URL(request.url).host;
}

/**
 * The origin the request was sent to: the first `X-Forwarded-Proto` value when it is http or https
 * (else the URL's scheme) and `Host` (else the URL's host). For `resolveAppOrigin` in an app whose
 * proxy passes `Host` through and refuses hosts it does not serve.
 */
export function readRequestOrigin(request: McpOriginRequest): string {
  const url = new URL(request.url);
  const proto = firstValue(request.headers.get("x-forwarded-proto"));
  const scheme = proto === "http" || proto === "https" ? proto : url.protocol.replace(/:$/, "");
  return new URL(`${scheme}://${readRequestHost(request)}`).origin;
}

/**
 * The resource origin the request was sent to, when its host is one of `resourceOrigins`; when two
 * share the host, the one whose scheme `X-Forwarded-Proto` names wins, else the first. Null otherwise.
 */
export function findServedResourceOrigin(origins: McpOrigins, request: McpOriginRequest): string | null {
  const host = readRequestHost(request);
  const candidates = origins.resourceOrigins.filter((origin) => new URL(origin).host === host);
  const proto = firstValue(request.headers.get("x-forwarded-proto"));
  return candidates.find((origin) => new URL(origin).protocol === `${proto ?? ""}:`) ?? candidates[0] ?? null;
}
