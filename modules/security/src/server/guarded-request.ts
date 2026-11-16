// A request to a URL someone else chose (an RFC 8058 one-click unsubscribe address, a webhook target, a
// link preview), refused when the target is not a public address. On Node the address check runs inside the
// socket's own lookup, so the address that is checked is the one connected to: no DNS rebinding window. On
// Cloudflare Workers `node:http` wraps `fetch` and refuses a `lookup`, so the host's addresses are checked just
// before the request instead (docs/07-runtime-providers.md); Workers' `fetch` reaches no private network.
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
  /**
   * Whether the check runs inside the socket's lookup (`true`) or on the resolved addresses just before the request
   * (`false`). Default: `true` on Node, `false` on Cloudflare Workers, whose `node:http` takes no `lookup`.
   */
  readonly pinLookup?: boolean;
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

/** Whether this code runs on Cloudflare Workers, whose runtime names itself in `navigator.userAgent`. */
export function isWorkersRuntime(): boolean {
  return (globalThis as { navigator?: { userAgent?: unknown } }).navigator?.userAgent === "Cloudflare-Workers";
}

/**
 * Starts a request to a checked target. Pinned (Node): the guarded lookup and no pooled socket (a pooled socket would
 * skip the lookup). Not pinned (Workers): every address of the host is checked first, and a refused one rejects with
 * `BlockedAddressError`; an abort of `signal` rejects with its reason. Rejects too when the runtime cannot send a
 * header (a control character, an invalid name).
 */
export async function openGuardedRequest(
  target: URL,
  init: { readonly method: string; readonly headers: Readonly<Record<string, string>>; readonly signal?: AbortSignal },
  seam: GuardedRequestSeam,
): Promise<ClientRequest> {
  const send = seam.request ?? (target.protocol === "https:" ? requestHttps : requestHttp);
  const isAllowedAddress = seam.isAllowedAddress ?? isPublicAddress;
  const resolveHost = seam.resolveHost ?? resolveWithDns;
  if (seam.pinLookup ?? !isWorkersRuntime()) {
    return send(target, { method: init.method, headers: { ...init.headers }, agent: false, lookup: guardLookup(isAllowedAddress, resolveHost) });
  }
  await checkHostAddresses(target, isAllowedAddress, resolveHost, init.signal);
  return send(target, { method: init.method, headers: { ...init.headers } });
}

/** Resolves the target's host and throws `BlockedAddressError` unless every address is allowed. An IP literal was checked by `checkGuardedUrl`. */
async function checkHostAddresses(
  target: URL,
  isAllowedAddress: (address: string) => boolean,
  resolveHost: ResolveHost,
  signal: AbortSignal | undefined,
): Promise<void> {
  const hostname = target.hostname.startsWith("[") ? target.hostname.slice(1, -1) : target.hostname;
  if (isIP(hostname) !== 0) return;
  signal?.throwIfAborted();
  const addresses = await new Promise<readonly LookupAddress[]>((resolve, reject) => {
    const onAbort = (): void => {
      reject(signal?.reason instanceof Error ? signal.reason : new Error("guarded request: aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    resolveHost(hostname, 0, (error, found) => {
      signal?.removeEventListener("abort", onAbort);
      if (error === null) resolve(found);
      else reject(error);
    });
  });
  if (addresses.length === 0 || !addresses.every((entry) => isAllowedAddress(entry.address))) {
    throw new BlockedAddressError(hostname);
  }
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

  const controller = new AbortController();
  return new Promise<GuardedRequestResult>((resolve) => {
    let settled = false;
    let timedOut = false;
    let request: ClientRequest | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      request?.destroy();
    }, timeoutMs);
    const settle = (result: GuardedRequestResult): void => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(result);
      }
    };
    const fail = (error: unknown): void => {
      if (timedOut) {
        settle(err("security.outbound_timeout"));
      } else if (error instanceof BlockedAddressError) {
        settle(err("security.outbound_blocked"));
      } else {
        settle(err("security.outbound_failed"));
      }
    };

    openGuardedRequest(checked.value, { method, headers: requestHeaders, signal: controller.signal }, seam).then((opened) => {
      request = opened;
      if (timedOut) {
        opened.destroy();
        fail(undefined);
        return;
      }
      opened.on("response", (response) => {
        settle(ok({ status: response.statusCode ?? 0 }));
        // The status is all the caller gets; closing here keeps an unbounded body out of memory.
        response.destroy();
      });
      opened.on("error", fail);
      opened.end(body);
    }, fail);
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
