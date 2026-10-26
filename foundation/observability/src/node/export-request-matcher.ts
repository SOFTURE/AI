/** The parts of an outgoing request that the http instrumentation hands to `ignoreOutgoingRequestHook`. */
export type OutgoingRequestTarget = {
  protocol?: string | null;
  hostname?: string | null;
  host?: string | null;
  port?: number | string | null;
  path?: string | null;
};

const DEFAULT_PORTS: Readonly<Record<string, string>> = {
  "http:": "80",
  "https:": "443",
};

/**
 * Whether an outgoing request goes to one of the OTLP export `urls`: the same scheme, host, port (the scheme's default
 * when absent) and path with query. Other paths and ports on the same host do not match, so the program's own calls to
 * a collector's host are still measured.
 */
export function createExportRequestMatcher(urls: readonly string[]): (target: OutgoingRequestTarget) => boolean {
  const keys = new Set(urls.map((url) => toKey(new URL(url))));
  return (target) => {
    if (keys.size === 0) {
      return false;
    }
    const protocol = target.protocol ?? "http:";
    const hostname = target.hostname ?? target.host ?? "localhost";
    const port = target.port === undefined || target.port === null ? "" : String(target.port);
    return keys.has(formatKey({ protocol, hostname, port, path: target.path ?? "/" }));
  };
}

function toKey(url: URL): string {
  return formatKey({
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
  });
}

function formatKey(parts: { protocol: string; hostname: string; port: string; path: string }): string {
  const hostname = parts.hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
  const port = parts.port === "" ? (DEFAULT_PORTS[parts.protocol] ?? "") : parts.port;
  return `${parts.protocol}//${hostname}:${port}${parts.path}`;
}
