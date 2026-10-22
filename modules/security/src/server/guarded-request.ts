// A request to a URL someone else chose (an RFC 8058 one-click unsubscribe address, a webhook target, a
// link preview), refused when the target is not a public address. The address check runs inside the
// socket's own lookup, so the address that is checked is the one connected to: no DNS rebinding window.
import { lookup as lookupHost, type LookupAddress } from "node:dns";
import { request as requestHttp, type ClientRequest, type RequestOptions } from "node:http";
import { request as requestHttps } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { err, ok, type Err, type Ok } from "@softure-ai/core";
import { isPublicAddress } from "./public-address.js";

export type GuardedRequestErrorCode =
  | "security.outbound_invalid_url"
  | "security.outbound_blocked"
  | "security.outbound_timeout"
  | "security.outbound_failed";

export type GuardedRequestResult = Ok<{ readonly status: number }> | Err<GuardedRequestErrorCode>;

export interface GuardedRequestOptions {
  readonly method: "GET" | "POST";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  /** The longest the whole exchange may take, up to the response status, in milliseconds. */
  readonly timeoutMs: number;
  /** Ports the URL may name, explicitly or through its scheme's default. */
  readonly allowedPorts?: readonly number[];
}

/** Resolves a host name to every address it has, in the shape of `dns.lookup` with `{ all: true }`. */
export type ResolveHost = (
  hostname: string,
  family: 0 | 4 | 6,
  callback: (error: Error | null, addresses: readonly LookupAddress[]) => void,
) => void;

/** Test seam: replace the transport, the address rule or the resolver, e.g. to reach a fake server on loopback. */
export interface GuardedRequestSeam {
  readonly request?: (url: URL, options: RequestOptions) => ClientRequest;
  readonly isAllowedAddress?: (address: string) => boolean;
  readonly resolveHost?: ResolveHost;
}

export const GUARDED_REQUEST_DEFAULT_PORTS: readonly number[] = [443];

/** The socket's lookup refused the host: one of its addresses is not allowed. */
export class BlockedAddressError extends Error {
  constructor(hostname: string) {
    super(`guarded request: ${hostname} resolves to an address that is not allowed`);
    this.name = "BlockedAddressError";
  }
}

const resolveWithDns: ResolveHost = (hostname, family, callback) => {
  lookupHost(hostname, { all: true, family }, (error, addresses) => {
    callback(error, addresses);
  });
};

/** Throws a `RangeError` naming `operation` unless `timeoutMs` is a positive whole number. */
export function assertTimeout(operation: string, timeoutMs: number): void {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError(`${operation}: timeoutMs must be a positive whole number, got ${String(timeoutMs)}`);
  }
}

/** Throws a `RangeError` naming `operation` unless `allowedPorts` lists ports from 1 to 65535. */
export function assertPorts(operation: string, allowedPorts: readonly number[]): void {
  if (allowedPorts.length === 0 || !allowedPorts.every((port) => Number.isInteger(port) && port > 0 && port < 65536)) {
    throw new RangeError(`${operation}: allowedPorts must list ports from 1 to 65535, got [${allowedPorts.join(", ")}]`);
  }
}

/**
 * The checks that run before any connection: `security.outbound_invalid_url` for a URL that does not parse
 * (against `base` when given), is not `http:` or `https:` or carries credentials; `security.outbound_blocked` for a
 * port outside `allowedPorts` or an IP literal that is not allowed. A host name is checked later, in the lookup.
 */
export function checkGuardedUrl(
  url: string,
  allowedPorts: readonly number[],
  isAllowedAddress: (address: string) => boolean,
  base?: URL,
): Ok<URL> | Err<"security.outbound_invalid_url" | "security.outbound_blocked"> {
  let target: URL;
  try {
    target = new URL(url, base);
  } catch {
    return err("security.outbound_invalid_url");
  }
  const isHttps = target.protocol === "https:";
  if ((!isHttps && target.protocol !== "http:") || target.username !== "" || target.password !== "") {
    return err("security.outbound_invalid_url");
  }
  const port = target.port === "" ? (isHttps ? 443 : 80) : Number(target.port);
  if (!allowedPorts.includes(port)) {
    return err("security.outbound_blocked");
  }
  // Node calls no lookup for an IP literal, so a literal is checked here. `URL.hostname` keeps IPv6 in brackets.
  const literal = target.hostname.startsWith("[") ? target.hostname.slice(1, -1) : target.hostname;
  if (isIP(literal) !== 0 && !isAllowedAddress(literal)) {
    return err("security.outbound_blocked");
  }
  return ok(target);
}

/**
 * Starts a request to a checked target with the guarded lookup and no pooled socket (a pooled socket would skip
 * the lookup). Throws synchronously when Node cannot send a header (a control character, an invalid name).
 */
export function openGuardedRequest(
  target: URL,
  init: { readonly method: string; readonly headers: Readonly<Record<string, string>> },
  seam: GuardedRequestSeam,
): ClientRequest {
  const send = seam.request ?? (target.protocol === "https:" ? requestHttps : requestHttp);
  return send(target, {
    method: init.method,
    headers: { ...init.headers },
    agent: false,
    lookup: guardLookup(seam.isAllowedAddress ?? isPublicAddress, seam.resolveHost ?? resolveWithDns),
  });
}

/**
 * Sends one request and returns its status, never following a redirect (a 3xx comes back as its status) and
 * never reading the body. Refused before any connection: a URL that does not parse, is not `http:` or
 * `https:` or carries credentials (`security.outbound_invalid_url`); a port outside `allowedPorts` (default
 * 443) or an IP literal that is not public (`security.outbound_blocked`). A host name is resolved to every
 * address and refused when any of them is not public (`security.outbound_blocked`). Past `timeoutMs` the
 * request is torn down (`security.outbound_timeout`); any other network or TLS failure is
 * `security.outbound_failed`.
 */
export async function sendGuardedRequest(
  url: string,
  options: GuardedRequestOptions,
  seam: GuardedRequestSeam = {},
): Promise<GuardedRequestResult> {
  const { method, headers = {}, body, timeoutMs, allowedPorts = GUARDED_REQUEST_DEFAULT_PORTS } = options;
  assertTimeout("sendGuardedRequest", timeoutMs);
  assertPorts("sendGuardedRequest", allowedPorts);
  const checked = checkGuardedUrl(url, allowedPorts, seam.isAllowedAddress ?? isPublicAddress);
  if (!checked.ok) {
    return checked;
  }

  const requestHeaders: Record<string, string> = { ...headers };
  if (body !== undefined && !Object.keys(requestHeaders).some((name) => name.toLowerCase() === "content-length")) {
    requestHeaders["content-length"] = String(Buffer.byteLength(body));
  }

  return new Promise<GuardedRequestResult>((resolve) => {
    let settled = false;
    let timedOut = false;
    let request: ClientRequest | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      request?.destroy();
    }, timeoutMs);
    const settle = (result: GuardedRequestResult): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }
    };

    try {
      request = openGuardedRequest(checked.value, { method, headers: requestHeaders }, seam);
    } catch {
      settle(err("security.outbound_failed"));
      return;
    }

    request.on("response", (response) => {
      settle(ok({ status: response.statusCode ?? 0 }));
      // The status is all the caller gets; closing here keeps an unbounded body out of memory.
      response.destroy();
    });
    request.on("error", (error) => {
      if (timedOut) {
        settle(err("security.outbound_timeout"));
      } else if (error instanceof BlockedAddressError) {
        settle(err("security.outbound_blocked"));
      } else {
        settle(err("security.outbound_failed"));
      }
    });
    request.end(body);
  });
}

/**
 * A `lookup` for the socket that resolves every address of the host and refuses the connection when any of
 * them is not allowed. It answers in the shape Node asked for: a list with `all: true` (what `net.connect`
 * asks when `autoSelectFamily` is on, the default since Node 20), else one address and its family.
 */
function guardLookup(isAllowedAddress: (address: string) => boolean, resolveHost: ResolveHost): LookupFunction {
  return (hostname, lookupOptions, callback) => {
    const family = lookupOptions.family === 4 || lookupOptions.family === 6 ? lookupOptions.family : 0;
    resolveHost(hostname, family, (error, addresses) => {
      if (error !== null) {
        callback(error, "", 0);
        return;
      }
      const first = addresses[0];
      if (first === undefined || !addresses.every((entry) => isAllowedAddress(entry.address))) {
        callback(new BlockedAddressError(hostname), "", 0);
        return;
      }
      if (lookupOptions.all === true) {
        // The `all` form passes the list where the single form passes one address.
        (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(null, [...addresses]);
      } else {
        callback(null, first.address, first.family);
      }
    });
  };
}
