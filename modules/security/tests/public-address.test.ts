// Which addresses count as public targets: every special-purpose range is refused, its neighbours are not.
import { isPublicAddress } from "@softure-ai/security/server";
import { describe, expect, it } from "vitest";

describe("isPublicAddress", () => {
  it.each([
    "8.8.8.8",
    "1.1.1.1",
    "100.63.255.255",
    "100.128.0.0",
    "172.15.255.255",
    "172.32.0.0",
    "192.0.1.1",
    "198.17.255.255",
    "198.20.0.0",
    "223.255.255.255",
  ])("accepts the public IPv4 address %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    ["this network", "0.0.0.0"],
    ["private 10/8", "10.1.2.3"],
    ["carrier-grade NAT", "100.64.0.1"],
    ["loopback", "127.0.0.1"],
    ["loopback, end of range", "127.255.255.254"],
    ["link-local metadata", "169.254.169.254"],
    ["private 172.16/12", "172.31.255.255"],
    ["IETF protocol assignments", "192.0.0.8"],
    ["documentation 192.0.2/24", "192.0.2.10"],
    ["6to4 relay", "192.88.99.1"],
    ["private 192.168/16", "192.168.1.1"],
    ["benchmarking", "198.19.0.1"],
    ["documentation 198.51.100/24", "198.51.100.7"],
    ["documentation 203.0.113/24", "203.0.113.7"],
    ["multicast", "224.0.0.251"],
    ["reserved", "240.0.0.1"],
    ["broadcast", "255.255.255.255"],
  ])("refuses %s (%s)", (_label, address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["2606:4700:4700::1111", "2a00:1450:4001:80b::200e", "[2606:4700::1]", "2001:200::1"])(
    "accepts the public IPv6 address %s",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );

  it.each([
    ["unspecified", "::"],
    ["loopback", "::1"],
    ["loopback in brackets", "[::1]"],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
    ["IPv4-mapped loopback in hex", "::ffff:7f00:1"],
    ["IPv4-mapped public address", "::ffff:8.8.8.8"],
    ["IPv4-compatible", "::127.0.0.1"],
    ["NAT64", "64:ff9b::7f00:1"],
    ["local-use NAT64", "64:ff9b:1::1"],
    ["discard-only", "100::1"],
    ["Teredo", "2001:0:4136:e378::1"],
    ["documentation 2001:db8::/32", "2001:db8::1"],
    ["6to4", "2002:7f00:1::1"],
    ["documentation 3fff::/20", "3fff::1"],
    ["unique local", "fd12:3456::1"],
    ["link-local", "fe80::1"],
    ["multicast", "ff02::1"],
  ])("refuses IPv6 %s (%s)", (_label, address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["", "localhost", "example.com", "127.1", "0x7f.0.0.1", "8.8.8.8:443", "fe80::1%eth0", "[8.8.8.8]"])(
    "treats %j as not an address",
    (value) => {
      expect(isPublicAddress(value)).toBe(false);
    },
  );
});
