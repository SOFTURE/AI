// Client-IP resolvers: where the address of the client comes from depends on what stands in front
// of the app, so the app picks the resolver (docs/02-module-standard.md §7). FIRE_TRACKER read only
// `cf-connecting-ip` and put every client without it into one shared bucket; here a request whose
// address cannot be resolved stays unidentified, and the caller refuses it.
import { BlockList, isIP } from "node:net";

/**
 * Reads the client address from request headers, or returns `null` when this resolver cannot tell.
 * A resolver must only trust headers that the app's own edge sets or overwrites.
 */
export type ClientIpResolver = (headers: Headers) => string | null;

export interface ForwardedForOptions {
  /**
   * The proxies in front of the app that append to `X-Forwarded-For`. A number is how many there
   * are (the client is that many entries from the right); a list holds their addresses or CIDR
   * ranges, skipped from the right.
   */
  readonly trustedProxies: number | readonly string[];
}

const MAX_TRUSTED_PROXY_HOPS = 20;
const IPV4_WITH_PORT = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/;
const BRACKETED_IPV6 = /^\[([^\]]+)\](?::\d{1,5})?$/;

/** The address in a header that holds exactly one address, such as `X-Real-IP`. */
export function headerIp(name: string): ClientIpResolver {
  if (name.trim() === "") {
    throw new TypeError("headerIp: the header name must not be empty");
  }
  try {
    new Headers().get(name);
  } catch {
    throw new TypeError(`headerIp: "${name}" is not a valid header name`);
  }
  return (headers) => {
    const value = headers.get(name);
    // Several values (a repeated header or a list) mean something in front did not overwrite it.
    if (value === null || value.includes(",")) {
      return null;
    }
    return normalizeIp(value);
  };
}

/**
 * `CF-Connecting-IP`, set by Cloudflare. Trust it only when the origin accepts traffic from
 * Cloudflare alone; a client that reaches the origin directly can send any value.
 */
export function cloudflareIp(): ClientIpResolver {
  return headerIp("cf-connecting-ip");
}

/**
 * The client address from `X-Forwarded-For`. Every proxy appends the address it received the
 * request from, so only the right end of the list is trustworthy: anything left of the trusted
 * proxies' entries came from the client and may be forged.
 */
export function forwardedForIp(options: ForwardedForOptions): ClientIpResolver {
  const { trustedProxies } = options;
  if (typeof trustedProxies === "number") {
    if (!Number.isInteger(trustedProxies) || trustedProxies < 1 || trustedProxies > MAX_TRUSTED_PROXY_HOPS) {
      throw new TypeError(
        `forwardedForIp: trustedProxies must be a whole number from 1 to ${String(MAX_TRUSTED_PROXY_HOPS)}, got ${String(trustedProxies)}`,
      );
    }
    return (headers) => {
      const entries = readForwardedFor(headers);
      const entry = entries[entries.length - trustedProxies];
      return entry === undefined ? null : normalizeIp(entry);
    };
  }

  const trusted = buildBlockList(trustedProxies);
  return (headers) => {
    const entries = readForwardedFor(headers);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const address = normalizeIp(entries[index] ?? "");
      // A garbled entry: nothing to its left can be trusted either.
      if (address === null) {
        return null;
      }
      if (!trusted.check(address, isIP(address) === 4 ? "ipv4" : "ipv6")) {
        return address;
      }
    }
    return null;
  };
}

/**
 * The canonical form of an address, or `null` when the value is not one: surrounding space, a port
 * and IPv6 brackets are removed, an IPv4-mapped (or IPv4-compatible) IPv6 address becomes IPv4, and IPv6 is written in
 * full lowercase groups, so one client always has one spelling.
 */
export function normalizeIp(value: string): string | null {
  let address = value.trim();
  const bracketed = BRACKETED_IPV6.exec(address);
  if (bracketed !== null) {
    address = bracketed[1] ?? "";
  } else {
    address = IPV4_WITH_PORT.exec(address)?.[1] ?? address;
  }

  // A zone index (`fe80::1%eth0`) is local to one host; no proxy forwards one.
  if (address.includes("%")) {
    return null;
  }
  const version = isIP(address);
  if (version === 4) {
    return address;
  }
  if (version !== 6) {
    return null;
  }

  const groups = expandIpv6(address);
  if (isIpv4Mapped(groups) || isIpv4Compatible(groups)) {
    const high = groups[6] ?? 0;
    const low = groups[7] ?? 0;
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
  }
  return groups.map((group) => group.toString(16)).join(":");
}

/**
 * The rate limit key of a normalised address. IPv6 is keyed by its network of `ipv6Subnet` bits:
 * one subscriber usually owns a whole /64 and could otherwise rotate through 2^64 keys.
 */
export function toClientKey(address: string, ipv6Subnet: number): string {
  if (isIP(address) !== 6 || ipv6Subnet >= 128) {
    return `ip:${address}`;
  }
  const groups = expandIpv6(address).map((group, index) => {
    const bitsKept = Math.min(16, Math.max(0, ipv6Subnet - index * 16));
    return bitsKept === 0 ? 0 : group & ((0xffff << (16 - bitsKept)) & 0xffff);
  });
  return `ip:${groups.map((group) => group.toString(16)).join(":")}/${String(ipv6Subnet)}`;
}

function readForwardedFor(headers: Headers): string[] {
  const value = headers.get("x-forwarded-for");
  return value === null ? [] : value.split(",").map((entry) => entry.trim());
}

function buildBlockList(entries: readonly string[]): BlockList {
  if (entries.length === 0) {
    throw new TypeError("forwardedForIp: trustedProxies must name at least one proxy address or range");
  }
  const list = new BlockList();
  for (const entry of entries) {
    const [address = "", prefix, ...rest] = entry.trim().split("/");
    const version = isIP(address);
    const maxPrefix = version === 4 ? 32 : 128;
    const prefixLength = prefix === undefined ? maxPrefix : Number(prefix);
    if (version === 0 || rest.length > 0 || !/^\d{1,3}$/.test(prefix ?? "0") || prefixLength > maxPrefix) {
      throw new TypeError(`forwardedForIp: "${entry}" in trustedProxies is not an address or a CIDR range`);
    }
    list.addSubnet(address, prefixLength, version === 4 ? "ipv4" : "ipv6");
  }
  return list;
}

/** The eight 16-bit groups of a valid IPv6 address (`isIP` already accepted it). */
function expandIpv6(address: string): number[] {
  let text = address.toLowerCase();
  // An embedded IPv4 tail (`::ffff:192.0.2.1`) is two groups.
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const [a = 0, b = 0, c = 0, d = 0] = tail.split(".").map(Number);
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const [head = "", rest] = text.split("::");
  const headGroups = head === "" ? [] : head.split(":");
  const tailGroups = rest === undefined || rest === "" ? [] : rest.split(":");
  const missing = rest === undefined ? 0 : 8 - headGroups.length - tailGroups.length;
  return [...headGroups, ...Array<string>(missing).fill("0"), ...tailGroups].map((group) => Number.parseInt(group, 16));
}

/** The deprecated `::a.b.c.d` form; `::` and `::1` are not IPv4 addresses. */
function isIpv4Compatible(groups: readonly number[]): boolean {
  return groups.slice(0, 6).every((group) => group === 0) && (groups[6] ?? 0) !== 0;
}

function isIpv4Mapped(groups: readonly number[]): boolean {
  return groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
}
