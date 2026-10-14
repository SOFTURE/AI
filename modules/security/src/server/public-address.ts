// Whether an IP address is a public internet target. Used by `sendGuardedRequest` to keep requests to
// URLs someone else chose away from loopback, the private network and other special-purpose ranges.
import { BlockList, isIPv4, isIPv6 } from "node:net";

// RFC 6890 and the IANA special-purpose registries. Anything listed here is never a public target.
const IPV4_SPECIAL_PURPOSE: readonly (readonly [string, number])[] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata endpoints
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
];

// IPv6 is public only inside global unicast (2000::/3), which already leaves out the unspecified and loopback
// addresses, IPv4-mapped and -compatible forms, NAT64, discard-only, ULA, link-local and multicast.
const IPV6_GLOBAL_UNICAST: readonly [string, number] = ["2000::", 3];
const IPV6_SPECIAL_PURPOSE: readonly (readonly [string, number])[] = [
  ["2001::", 23], // IETF protocol assignments, Teredo included
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4
  ["3fff::", 20], // documentation
];

const ipv4Blocked = new BlockList();
for (const [network, prefix] of IPV4_SPECIAL_PURPOSE) {
  ipv4Blocked.addSubnet(network, prefix, "ipv4");
}
const ipv6Global = new BlockList();
ipv6Global.addSubnet(IPV6_GLOBAL_UNICAST[0], IPV6_GLOBAL_UNICAST[1], "ipv6");
const ipv6Blocked = new BlockList();
for (const [network, prefix] of IPV6_SPECIAL_PURPOSE) {
  ipv6Blocked.addSubnet(network, prefix, "ipv6");
}

/**
 * True when `address` is an IPv4 or IPv6 address that is reachable on the public internet: not loopback,
 * private, link-local, carrier-grade NAT, multicast, documentation, 6to4, NAT64 or any other RFC 6890
 * special-purpose range. An IPv6 literal in URL brackets (`[2606:4700::1]`) is accepted; an IPv4 address
 * written inside IPv6 (`::ffff:127.0.0.1`) is never public. Anything that is not an address gives `false`.
 */
export function isPublicAddress(address: string): boolean {
  if (isIPv4(address)) {
    return !ipv4Blocked.check(address, "ipv4");
  }
  // Only IPv6 is written in brackets, as `URL.hostname` keeps it.
  const bare = address.startsWith("[") && address.endsWith("]") ? address.slice(1, -1) : address;
  if (isIPv6(bare) && !bare.includes("%")) {
    return ipv6Global.check(bare, "ipv6") && !ipv6Blocked.check(bare, "ipv6");
  }
  return false;
}
