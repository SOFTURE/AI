import { connect, isIP } from "node:net";

const DEFAULT_HTTPS_PORT = 443;

/** The server behind the CDN, as passed to `verify --origin`. */
export interface OriginAddress {
  host: string;
  port: number;
}

export type ParsedOriginAddress = { ok: true; address: OriginAddress } | { ok: false; reason: string };

/** The `origin` row of the verify report: passes only when a direct connection to the origin got no answer. */
export interface OriginReport {
  address: string;
  passed: boolean;
  detail: string;
}

/** What one direct connection attempt to the origin ended with. */
export type OriginProbe =
  | { outcome: "accepted"; remoteAddress: string | undefined }
  | { outcome: "timeout" }
  | { outcome: "error"; code: string };

/** Errors that mean nothing answered on the port: the connection was refused, reset or could not be routed. */
const CLOSED_CODES: Record<string, string> = {
  ECONNREFUSED: "connection refused (nothing listens there)",
  ECONNRESET: "connection reset",
  EHOSTUNREACH: "host unreachable",
  ENETUNREACH: "network unreachable",
};

/** Errors that mean the address could not be looked up, so nothing was checked. */
const LOOKUP_CODES = new Set(["ENOTFOUND", "EAI_AGAIN", "EAI_FAIL", "EAI_NONAME"]);

/** `host`, `host:port`, `[v6]`, `[v6]:port` or a bare IPv6 address; the port defaults to 443. */
export function parseOriginAddress(text: string): ParsedOriginAddress {
  if (text.trim() === "") return { ok: false, reason: "the origin address is empty" };
  // A bare IPv6 address has colons of its own, so it cannot carry a port without brackets.
  if (isIP(text) === 6) return { ok: true, address: { host: text, port: DEFAULT_HTTPS_PORT } };
  const invalid = {
    ok: false as const,
    reason: `${JSON.stringify(text)} is not a host or IP address with an optional port, for example 203.0.113.7 or 203.0.113.7:443`,
  };
  if (!/^[\w.-]+(:\d+)?$|^\[[\da-f:.]+\](:\d+)?$/i.test(text)) return invalid;
  let url: URL;
  try {
    url = new URL(`https://${text}`);
  } catch {
    return invalid;
  }
  // `URL` keeps brackets around an IPv6 host; the socket takes it without them.
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  const port = url.port === "" ? DEFAULT_HTTPS_PORT : Number(url.port);
  if (port === 0) return invalid;
  return { ok: true, address: { host, port } };
}

/** `host:port`, with brackets around an IPv6 host. */
export function formatOriginAddress(address: OriginAddress): string {
  return isIP(address.host) === 6 ? `[${address.host}]:${address.port}` : `${address.host}:${address.port}`;
}

/** The `origin` row for one probe: an accepted connection or an address that was not checked fails it. */
export function classifyOriginProbe(options: { address: OriginAddress; probe: OriginProbe; timeoutMs: number }): OriginReport {
  const { probe, timeoutMs } = options;
  const address = formatOriginAddress(options.address);
  if (probe.outcome === "accepted") {
    const via = probe.remoteAddress === undefined || probe.remoteAddress === options.address.host ? "" : ` (${probe.remoteAddress})`;
    return {
      address,
      passed: false,
      detail: `${address}${via} accepted a direct connection; the firewall lets more than the CDN through`,
    };
  }
  if (probe.outcome === "timeout") {
    return { address, passed: true, detail: `${address} no answer within ${timeoutMs} ms (dropped)` };
  }
  const closed = CLOSED_CODES[probe.code];
  if (closed !== undefined) return { address, passed: true, detail: `${address} ${closed}` };
  if (LOOKUP_CODES.has(probe.code)) {
    return { address, passed: false, detail: `${address} could not be resolved (${probe.code}); nothing was checked` };
  }
  return { address, passed: false, detail: `${address} could not be checked: ${probe.code}` };
}

/**
 * Opens one TCP connection to the origin and closes it at once, sending nothing. The socket is destroyed on every
 * path; an error or a timeout is an outcome, never thrown.
 */
export function probeOrigin(options: { address: OriginAddress; timeoutMs: number }): Promise<OriginProbe> {
  const { address, timeoutMs } = options;
  return new Promise((resolve) => {
    const socket = connect({ host: address.host, port: address.port });
    // The first outcome wins; a promise settles once, so a later timeout or error only closes the socket again.
    const finish = (probe: OriginProbe): void => {
      socket.destroy();
      resolve(probe);
    };
    socket.setTimeout(timeoutMs, () => finish({ outcome: "timeout" }));
    // `on`, not `once`: a second error after the first must not become an unhandled one.
    socket.on("error", (error: NodeJS.ErrnoException) => finish({ outcome: "error", code: error.code ?? error.message }));
    socket.once("connect", () => finish({ outcome: "accepted", remoteAddress: socket.remoteAddress }));
  });
}

/** The `origin` row for `address`: one direct connection attempt within `timeoutMs`. */
export async function runOriginCheck(options: { address: OriginAddress; timeoutMs: number }): Promise<OriginReport> {
  const probe = await probeOrigin(options);
  return classifyOriginProbe({ ...options, probe });
}
