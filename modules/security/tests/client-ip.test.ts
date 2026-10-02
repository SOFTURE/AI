// Client-IP resolvers: which address each one trusts, and what it does with forged, garbled or
// missing headers.
import { cloudflareIp, forwardedForIp, headerIp, normalizeIp } from "@softure-ai/security";
import { describe, expect, it } from "vitest";

function headersOf(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("normalizeIp", () => {
  it.each([
    ["192.0.2.1", "192.0.2.1"],
    ["  192.0.2.1 ", "192.0.2.1"],
    ["192.0.2.1:8080", "192.0.2.1"],
    ["2001:DB8::1", "2001:db8:0:0:0:0:0:1"],
    ["[2001:db8::1]:443", "2001:db8:0:0:0:0:0:1"],
    ["[2001:db8::1]", "2001:db8:0:0:0:0:0:1"],
    ["::ffff:192.0.2.1", "192.0.2.1"],
    ["::FFFF:c000:0201", "192.0.2.1"],
    ["::1", "0:0:0:0:0:0:0:1"],
    // The deprecated IPv4-compatible form is the IPv4 address, not one shared /64.
    ["::1.2.3.4", "1.2.3.4"],
    ["::", "0:0:0:0:0:0:0:0"],
    ["2001:db8::", "2001:db8:0:0:0:0:0:0"],
    ["64:ff9b::192.0.2.1", "64:ff9b:0:0:0:0:c000:201"],
    // Without brackets a trailing `:443` is one more group of a valid address, not a port.
    ["2001:db8::1:443", "2001:db8:0:0:0:0:1:443"],
  ])("writes %j as %j", (input, expected) => {
    expect(normalizeIp(input)).toBe(expected);
  });

  it.each(["", "unknown", "no-proxy", "192.0.2", "192.0.2.256", "fe80::1%eth0", "192.0.2.1:", "[192.0.2.1]x", "[::1]:"])(
    "rejects %j",
    (input) => {
      expect(normalizeIp(input)).toBeNull();
    },
  );
});

describe("headerIp and cloudflareIp", () => {
  it("reads CF-Connecting-IP", () => {
    expect(cloudflareIp()(headersOf({ "cf-connecting-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("finds nothing without the header, so the client is not put into a shared bucket", () => {
    expect(cloudflareIp()(headersOf({ "x-forwarded-for": "203.0.113.7" }))).toBeNull();
  });

  it("refuses a header holding several values", () => {
    expect(headerIp("x-real-ip")(headersOf({ "x-real-ip": "203.0.113.7, 198.51.100.4" }))).toBeNull();
  });

  it("refuses a value that is not an address", () => {
    expect(headerIp("x-real-ip")(headersOf({ "x-real-ip": "localhost" }))).toBeNull();
  });

  it("throws on an empty header name", () => {
    expect(() => headerIp(" ")).toThrow("headerIp: the header name must not be empty");
  });

  it("throws at construction on an invalid header name, not on every request", () => {
    expect(() => headerIp("x real")).toThrow('headerIp: "x real" is not a valid header name');
  });
});

describe("forwardedForIp with a number of proxies", () => {
  it("takes the address the single proxy appended", () => {
    const resolve = forwardedForIp({ trustedProxies: 1 });
    expect(resolve(headersOf({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("ignores entries the client forged on the left", () => {
    const resolve = forwardedForIp({ trustedProxies: 1 });
    expect(resolve(headersOf({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("counts from the right behind several proxies", () => {
    const resolve = forwardedForIp({ trustedProxies: 2 });
    // client 203.0.113.7 -> proxy A (appends the client) -> proxy B (appends A, 10.0.0.2) -> app
    expect(resolve(headersOf({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.2" }))).toBe("203.0.113.7");
  });

  it("finds nothing when the list is shorter than the proxy chain", () => {
    const resolve = forwardedForIp({ trustedProxies: 2 });
    expect(resolve(headersOf({ "x-forwarded-for": "203.0.113.7" }))).toBeNull();
  });

  it("finds nothing without the header or with a garbled entry", () => {
    const resolve = forwardedForIp({ trustedProxies: 1 });
    expect(resolve(headersOf({}))).toBeNull();
    expect(resolve(headersOf({ "x-forwarded-for": "203.0.113.7, garbage" }))).toBeNull();
  });

  it("reads repeated headers as one list", () => {
    const headers = new Headers();
    headers.append("x-forwarded-for", "6.6.6.6");
    headers.append("x-forwarded-for", "203.0.113.7");
    expect(forwardedForIp({ trustedProxies: 1 })(headers)).toBe("203.0.113.7");
  });

  it.each([0, -1, 1.5, 21, Number.NaN])("throws on trustedProxies %s", (count) => {
    expect(() => forwardedForIp({ trustedProxies: count })).toThrow("forwardedForIp: trustedProxies must be a whole number from 1 to 20");
  });
});

describe("forwardedForIp with proxy addresses", () => {
  const resolve = forwardedForIp({ trustedProxies: ["10.0.0.0/8", "2001:db8:ffff::/48", "192.0.2.10"] });

  it("skips trusted proxies from the right and takes the first other address", () => {
    expect(resolve(headersOf({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 192.0.2.10, 10.1.2.3" }))).toBe("203.0.113.7");
  });

  it("matches IPv6 ranges", () => {
    expect(resolve(headersOf({ "x-forwarded-for": "2001:db8:1::5, 2001:db8:ffff::1" }))).toBe("2001:db8:1:0:0:0:0:5");
  });

  it("finds nothing when every entry is a trusted proxy", () => {
    expect(resolve(headersOf({ "x-forwarded-for": "10.0.0.1, 10.0.0.2" }))).toBeNull();
  });

  it("stops at a garbled entry instead of trusting what is left of it", () => {
    expect(resolve(headersOf({ "x-forwarded-for": "203.0.113.7, nonsense, 10.0.0.1" }))).toBeNull();
  });

  it.each([[[]], [["10.0.0.0/33"]], [["not-an-ip"]], [["10.0.0.0/8/1"]], [["10.0.0.0/x"]]])("throws on trustedProxies %j", (list) => {
    expect(() => forwardedForIp({ trustedProxies: list })).toThrow(/^forwardedForIp: /);
  });
});
