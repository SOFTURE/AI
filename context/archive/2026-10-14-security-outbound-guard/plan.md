# Plan: security-outbound-guard

Input: change.md, research.md. Complexity: small (two phases).

## Goal

`@softure-ai/security/server` exports `isPublicAddress` and `sendGuardedRequest` as issue #479 proposes, with a test
seam; README and CHANGELOG describe how an app replaces its local guard.

**Out of scope:** any adopting app; following redirects; reading response bodies.

## Key decisions

- Public means: IPv4 outside the RFC 6890 / IANA special-purpose blocks (0/8, 10/8, 100.64/10, 127/8, 169.254/16,
  172.16/12, 192.0.0/24, 192.0.2/24, 192.88.99/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4,
  240/4); IPv6 inside global unicast `2000::/3` and outside 2001::/23, 2001:db8::/32, 2002::/16, 3fff::/20,
  plus never `::/96`, `::ffff:0:0/96`, `64:ff9b::/96`, `64:ff9b:1::/48`, `100::/64`, ULA, link-local, multicast
  (all outside `2000::/3`). Mapped or compatible IPv4 in IPv6 is refused whatever the embedded address. Anything
  that is not an address is not public.
- URL: `http:` or `https:` only, no credentials, port (explicit or the protocol default) must be in `allowedPorts`
  (default `[443]`); else `security.outbound_invalid_url`. An IP literal host is checked before connecting.
- Lookup: resolve with `{ all: true }`; refuse when the list is empty or any address is not allowed; answer as an
  array or a single address per `options.all`. A refusal surfaces as `security.outbound_blocked`.
- `agent: false`; no redirect following (a 3xx is returned as its status); one timer over the whole exchange
  destroys the request (`security.outbound_timeout`); the response is destroyed on headers.
- Seam: third argument `{ request?, isAllowedAddress?, lookup? }`; defaults `http(s).request`, `isPublicAddress`,
  `dns.lookup`.
- Invalid `timeoutMs` or `allowedPorts` throws `RangeError`.

## Phase 1: Public addresses

- `src/server/public-address.ts` with `isPublicAddress`; tests over each range, edges and non-addresses.

Done when: `npx vitest run modules/security` green.

## Phase 2: Guarded request

- `src/server/guarded-request.ts`; error codes and messages; server exports; tests against a loopback server
  (status, POST body and headers, redirect not followed, timeout, blocked literal, blocked lookup with `all` true
  and false, invalid URLs and ports); README section and CHANGELOG `Unreleased`.

Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Public addresses

#### Automated
- [ ] 1.1 `isPublicAddress` refuses every special-purpose range
- [ ] 1.2 Package tests green

### Phase 2: Guarded request

#### Automated
- [x] 2.1 `sendGuardedRequest` with guarded lookup, error codes, exports and seam — ecc9a34
- [x] 2.2 README and CHANGELOG describe the helper and the migration — ecc9a34
- [x] 2.3 Typecheck, lint, test and build green — ecc9a34
