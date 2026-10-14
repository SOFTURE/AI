# Research: security-outbound-guard

Input: change.md, issue #479. Depth: quick.
Snapshot: cfb9aad on claude/project-thread-egsklk, 2026-10-14 21:10 CEST.

## Summary

`@softure-ai/security` has no outbound client. Node 22 gives every piece needed: `http.request`/`https.request`
take a custom `lookup` and `agent: false`; `net.connect` calls `lookup` with `{ all: true }` when
`autoSelectFamily` is on and expects an array back; for an IP literal no lookup runs, so a literal is checked before
the request. `net.BlockList` matches IPv4 and IPv6 subnets, and checks IPv4-mapped IPv6 against IPv4 rules.
`new URL()` normalises IPv4 shorthand (`0x7f.1` → `127.0.0.1`), keeps IPv6 literals in brackets and rejects zone
ids.

## Current state

- `modules/security/src/server/index.ts`: server entry (rate limits, identify, bucket listing).
- `modules/security/src/contract.ts:5-10`: `SecurityErrorCode` union; `src/messages/en.ts` one message per code.
- `modules/security/src/read-small-body.ts`: pattern for `ok`/`err` results and `RangeError` on programmer input.
- `modules/security/CHANGELOG.md`: `Unreleased` already carries #469.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Address check | `src/server/public-address.ts` (new) | `isPublicAddress` over RFC 6890 ranges |
| Outbound request | `src/server/guarded-request.ts` (new) | `sendGuardedRequest` with guarded lookup |
| Contract and copy | `src/contract.ts`, `src/messages/en.ts` | four `security.outbound_*` codes |
| Entry | `src/server/index.ts` | exports |
| Docs | `README.md`, `CHANGELOG.md` | usage and migration |
| Tests | `tests/guarded-request.test.ts`, `tests/public-address.test.ts` (new) | behaviour |

## Data

None.

## Tests

`npx vitest run modules/security`. A loopback `http.createServer` serves as the fake target through the seam
(address predicate allowing loopback, port in `allowedPorts`); `dns.lookup` behaviour is tested by injecting a
lookup into the guarded lookup function.

## Patterns to follow

- Results via `ok`/`err` from `@softure-ai/core`; programmer errors throw `RangeError` naming the function.
