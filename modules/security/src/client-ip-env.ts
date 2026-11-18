// The client-IP resolver from the environment, for an app that runs behind different edges by configuration: the
// hosted instance behind Cloudflare (`CF-Connecting-IP`), a self-hosted one behind its own reverse proxy, which
// appends to `X-Forwarded-For` or sets one header of its own. `CLIENT_IP_SOURCE` picks one; a value the reader does
// not understand is reported, never replaced by a default, so the app stops at start with the reason.
import { cloudflareIp, forwardedForIp, headerIp, type ClientIpResolver } from "./client-ip.js";

export const CLIENT_IP_SOURCE_ENV = "CLIENT_IP_SOURCE";
export const TRUSTED_PROXY_HOPS_ENV = "TRUSTED_PROXY_HOPS";

/** The most proxies `TRUSTED_PROXY_HOPS` may name, as `forwardedForIp` accepts. */
const MAX_TRUSTED_PROXY_HOPS = 20;
const HEADER_PREFIX = "header:";
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

export type ClientIpSource =
  | { readonly kind: "cloudflare" }
  | { readonly kind: "forwarded-for"; readonly trustedProxyHops: number }
  | { readonly kind: "header"; readonly name: string }
  | { readonly kind: "invalid"; readonly reason: string };

/**
 * The source `CLIENT_IP_SOURCE` names: `cloudflare` (also when unset), `forwarded-for` (the entry `TRUSTED_PROXY_HOPS`
 * places from the right of `X-Forwarded-For`, one by default) or `header:<name>` (a header the proxy overwrites, such
 * as `header:x-real-ip`).
 */
export function readClientIpSource(env: Readonly<Record<string, string | undefined>>): ClientIpSource {
  const value = env[CLIENT_IP_SOURCE_ENV]?.trim() ?? "";
  if (value === "" || value === "cloudflare") return { kind: "cloudflare" };
  if (value === "forwarded-for") return readForwardedFor(env[TRUSTED_PROXY_HOPS_ENV]);
  if (value.startsWith(HEADER_PREFIX)) {
    const name = value.slice(HEADER_PREFIX.length).trim().toLowerCase();
    if (HEADER_NAME.test(name)) return { kind: "header", name };
    return { kind: "invalid", reason: `${CLIENT_IP_SOURCE_ENV} names no valid header: "${value}"` };
  }
  return { kind: "invalid", reason: `${CLIENT_IP_SOURCE_ENV} must be cloudflare, forwarded-for or header:<name>, got "${value}"` };
}

function readForwardedFor(hopsValue: string | undefined): ClientIpSource {
  const trimmed = hopsValue?.trim() ?? "";
  if (trimmed === "") return { kind: "forwarded-for", trustedProxyHops: 1 };
  const hops = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  if (Number.isInteger(hops) && hops >= 1 && hops <= MAX_TRUSTED_PROXY_HOPS) return { kind: "forwarded-for", trustedProxyHops: hops };
  return {
    kind: "invalid",
    reason: `${TRUSTED_PROXY_HOPS_ENV} must be a whole number from 1 to ${String(MAX_TRUSTED_PROXY_HOPS)}, got "${trimmed}"`,
  };
}

/** The resolver for a source. Throws for an invalid one, with its reason: a wrong setting stops the app at start. */
export function createClientIpResolver(source: ClientIpSource): ClientIpResolver {
  switch (source.kind) {
    case "cloudflare":
      return cloudflareIp();
    case "forwarded-for":
      return forwardedForIp({ trustedProxies: source.trustedProxyHops });
    case "header":
      return headerIp(source.name);
    case "invalid":
      throw new Error(`createClientIpResolver: ${source.reason}`);
  }
}

/** `createClientIpResolver(readClientIpSource(env))`: the resolver the environment names, for `security({ clientIp })`. */
export function clientIpFromEnv(env: Readonly<Record<string, string | undefined>>): ClientIpResolver {
  return createClientIpResolver(readClientIpSource(env));
}
