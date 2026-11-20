// The client-IP resolver an app's environment names: the settings it reads, the ones it refuses, and the resolver each
// one gives.
import { clientIpFromEnv, createClientIpResolver, readClientIpSource } from "@softure-ai/security";
import { describe, expect, it } from "vitest";

describe("readClientIpSource", () => {
  it("reads Cloudflare's header when nothing is set, as the hosted instance does", () => {
    expect(readClientIpSource({})).toEqual({ kind: "cloudflare" });
    expect(readClientIpSource({ CLIENT_IP_SOURCE: "  " })).toEqual({ kind: "cloudflare" });
    expect(readClientIpSource({ CLIENT_IP_SOURCE: "cloudflare" })).toEqual({ kind: "cloudflare" });
  });

  it("trusts one proxy in X-Forwarded-For by default and the number TRUSTED_PROXY_HOPS names", () => {
    expect(readClientIpSource({ CLIENT_IP_SOURCE: "forwarded-for" })).toEqual({ kind: "forwarded-for", trustedProxyHops: 1 });
    expect(readClientIpSource({ CLIENT_IP_SOURCE: "forwarded-for", TRUSTED_PROXY_HOPS: "2" })).toEqual({ kind: "forwarded-for", trustedProxyHops: 2 });
    expect(readClientIpSource({ CLIENT_IP_SOURCE: "forwarded-for", TRUSTED_PROXY_HOPS: "20" })).toEqual({ kind: "forwarded-for", trustedProxyHops: 20 });
  });

  it("refuses a number of proxies outside 1 to 20 or not a whole number", () => {
    for (const hops of ["0", "21", "1.5", "-1", "two"]) {
      expect(readClientIpSource({ CLIENT_IP_SOURCE: "forwarded-for", TRUSTED_PROXY_HOPS: hops })).toEqual({
        kind: "invalid",
        reason: `TRUSTED_PROXY_HOPS must be a whole number from 1 to 20, got "${hops}"`,
      });
    }
  });

  it("reads one header the proxy sets, in lower case", () => {
    expect(readClientIpSource({ CLIENT_IP_SOURCE: "header:X-Real-IP" })).toEqual({ kind: "header", name: "x-real-ip" });
  });

  it("refuses an empty or malformed header name and an unknown source", () => {
    expect(readClientIpSource({ CLIENT_IP_SOURCE: "header:" })).toEqual({
      kind: "invalid",
      reason: 'CLIENT_IP_SOURCE names no valid header: "header:"',
    });
    expect(readClientIpSource({ CLIENT_IP_SOURCE: "header:x real ip" }).kind).toBe("invalid");
    expect(readClientIpSource({ CLIENT_IP_SOURCE: "remote-addr" })).toEqual({
      kind: "invalid",
      reason: 'CLIENT_IP_SOURCE must be cloudflare, forwarded-for or header:<name>, got "remote-addr"',
    });
  });
});

describe("createClientIpResolver", () => {
  it("reads CF-Connecting-IP for cloudflare and ignores X-Forwarded-For", () => {
    const resolve = createClientIpResolver({ kind: "cloudflare" });
    expect(resolve(new Headers({ "cf-connecting-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(resolve(new Headers({ "x-forwarded-for": "203.0.113.7" }))).toBeNull();
  });

  it("takes the entry the trusted proxies appended, never a forged one to its left", () => {
    const resolve = createClientIpResolver({ kind: "forwarded-for", trustedProxyHops: 1 });
    expect(resolve(new Headers({ "x-forwarded-for": "198.51.100.1, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(resolve(new Headers({ "cf-connecting-ip": "203.0.113.7" }))).toBeNull();
    const twoHops = createClientIpResolver({ kind: "forwarded-for", trustedProxyHops: 2 });
    expect(twoHops(new Headers({ "x-forwarded-for": "198.51.100.1, 203.0.113.7, 10.0.0.2" }))).toBe("203.0.113.7");
  });

  it("reads the named header", () => {
    const resolve = createClientIpResolver({ kind: "header", name: "x-real-ip" });
    expect(resolve(new Headers({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(resolve(new Headers())).toBeNull();
  });

  it("stops the app at start with the reason of an invalid setting", () => {
    expect(() => createClientIpResolver({ kind: "invalid", reason: "CLIENT_IP_SOURCE is wrong" })).toThrow(
      "createClientIpResolver: CLIENT_IP_SOURCE is wrong",
    );
  });
});

describe("clientIpFromEnv", () => {
  it("gives the resolver the environment names", () => {
    const resolve = clientIpFromEnv({ CLIENT_IP_SOURCE: "header:x-real-ip" });
    expect(resolve(new Headers({ "x-real-ip": "203.0.113.7", "cf-connecting-ip": "198.51.100.1" }))).toBe("203.0.113.7");
  });

  it("throws the reason of an invalid setting", () => {
    expect(() => clientIpFromEnv({ CLIENT_IP_SOURCE: "remote-addr" })).toThrow(/CLIENT_IP_SOURCE must be cloudflare/);
  });
});
