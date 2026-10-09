// The origins one request is served under: the app origin every OAuth URL is built from, and the
// other public hosts whose root may be named as a protected resource. Pure: no config, no database.
// Reading the request is core's rule (`readRequestHost`, `readRequestOrigin`, issue #311).
import { readForwardedProto, readRequestHost, readRequestOrigin, type OriginRequest } from "@softure-ai/core";

export { readRequestHost, readRequestOrigin };

/** What the origin helpers read from a request: a Web `Request`, or Next's `headers()` with a URL. */
export type McpOriginRequest = OriginRequest;

export interface McpOrigins {
  /** The issuer, and the origin of every endpoint, of `resource_metadata` and of the consent form. */
  readonly appOrigin: string;
  /** Other public hosts (`resourceOrigins`), each a bare origin. */
  readonly resourceOrigins: readonly string[];
}

/**
 * The resource origin the request was sent to, when its host is one of `resourceOrigins`; when two
 * share the host, the one whose scheme `X-Forwarded-Proto` names wins, else the first. Null otherwise.
 */
export function findServedResourceOrigin(origins: McpOrigins, request: McpOriginRequest): string | null {
  const host = readRequestHost(request);
  const candidates = origins.resourceOrigins.filter((origin) => new URL(origin).host === host);
  const proto = readForwardedProto(request);
  return candidates.find((origin) => new URL(origin).protocol === `${proto ?? ""}:`) ?? candidates[0] ?? null;
}
