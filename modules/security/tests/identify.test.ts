// Turning a request into rate limit keys: the client by its address, a subject by a hash.
import { cloudflareIp, forwardedForIp, type ClientIpResolver } from "@softure-ai/security";
import { identifyClient, subjectKey } from "@softure-ai/security/server";
import { describe, expect, it } from "vitest";
import { createConfig } from "./support.js";

describe("identifyClient", () => {
  it("keys an IPv4 client by its address", () => {
    const ctx = { config: createConfig({ clientIp: cloudflareIp() }) };
    expect(identifyClient(ctx, new Headers({ "cf-connecting-ip": "203.0.113.7" }))).toEqual({ ok: true, value: "ip:203.0.113.7" });
  });

  it("keys an IPv6 client by its /64, so one subscriber cannot rotate through its addresses", () => {
    const ctx = { config: createConfig({ clientIp: cloudflareIp() }) };
    const first = identifyClient(ctx, new Headers({ "cf-connecting-ip": "2001:db8:1:2:aaaa::1" }));
    const second = identifyClient(ctx, new Headers({ "cf-connecting-ip": "2001:db8:1:2:bbbb::9" }));
    expect(first).toEqual({ ok: true, value: "ip:2001:db8:1:2:0:0:0:0/64" });
    expect(second).toEqual(first);
  });

  it("honours a narrower IPv6 subnet, and the full address at 128", () => {
    const headers = new Headers({ "cf-connecting-ip": "2001:db8:1:2:aaaa::1" });
    expect(identifyClient({ config: createConfig({ clientIp: cloudflareIp(), ipv6Subnet: 56 }) }, headers)).toEqual({
      ok: true,
      value: "ip:2001:db8:1:0:0:0:0:0/56",
    });
    expect(identifyClient({ config: createConfig({ clientIp: cloudflareIp(), ipv6Subnet: 128 }) }, headers)).toEqual({
      ok: true,
      value: "ip:2001:db8:1:2:aaaa:0:0:1",
    });
  });

  it("tries the resolvers in order and takes the first address found", () => {
    const ctx = { config: createConfig({ clientIp: [cloudflareIp(), forwardedForIp({ trustedProxies: 1 })] }) };
    expect(identifyClient(ctx, new Headers({ "x-forwarded-for": "198.51.100.4" }))).toEqual({ ok: true, value: "ip:198.51.100.4" });
    expect(identifyClient(ctx, new Headers({ "x-forwarded-for": "198.51.100.4", "cf-connecting-ip": "203.0.113.7" }))).toEqual({
      ok: true,
      value: "ip:203.0.113.7",
    });
  });

  it("normalises what a custom resolver returns and skips a value that is not an address", () => {
    const fromCookie: ClientIpResolver = () => "not-an-address";
    const local: ClientIpResolver = () => "::ffff:127.0.0.1";
    const ctx = { config: createConfig({ clientIp: [fromCookie, local] }) };
    expect(identifyClient(ctx, new Headers())).toEqual({ ok: true, value: "ip:127.0.0.1" });
  });

  it("returns client_unidentified when no resolver finds an address, never a shared key", () => {
    const ctx = { config: createConfig({ clientIp: cloudflareIp() }) };
    expect(identifyClient(ctx, new Headers())).toEqual({ ok: false, error: "security.client_unidentified" });
  });
});

describe("subjectKey", () => {
  it("stores a 32-character SHA-256 prefix instead of the subject", () => {
    // sha256("ada@example.com")
    expect(subjectKey("ada@example.com")).toBe("subject:b5fc85e55755f9e0d030a10ab4429b6b");
  });

  it("gives different subjects different keys and the same subject the same key", () => {
    expect(subjectKey("user:1")).toBe(subjectKey("user:1"));
    expect(subjectKey("user:1")).not.toBe(subjectKey("user:2"));
  });

  it("throws on an empty subject", () => {
    expect(() => subjectKey("")).toThrow("subjectKey: the subject must not be empty");
  });
});
