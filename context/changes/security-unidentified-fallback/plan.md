# Plan: security-unidentified-fallback

Input: change.md (research skipped, see its Notes). Complexity: small.

## Goal

An app passes `unidentified: { key: "test-stack" }` and every request no resolver identifies is counted under
`unidentified:test-stack`; without the option (or with `"refuse"`) such a request is still
`security.client_unidentified`. README §3 shows one configuration that serves production behind Cloudflare, a
test stack without it and `next dev`, switched by an environment variable the app reads, and warns about
`X-Forwarded-For` / `X-Real-IP` behind Cloudflare and a proxy.

**Out of scope:** a new resolver, reading the environment inside the module (the switch stays the app's), a
release, changes to the example app (its e2e sends `CF-Connecting-IP` itself and needs no fallback).

## Approach

**Starting point:** `identifyClient` loops over `options.clientIp` and returns `err("security.client_unidentified")`
after the loop (`modules/security/src/server/identify.ts:17-29`); the options are a strict zod object
(`modules/security/src/options.ts:26-46`). The README's only fallback is a resolver returning `"127.0.0.1"`.

**Chosen:** the issue's option 2 plus its option 1 as the documented way to turn it on. An explicit option keeps the
fallback visible in config and keeps it out of the resolver list, where it reads as an address.
Rejected: docs only - the fallback stays a fake address that `normalizeIp` turns into a real-looking `ip:` key;
an environment variable read by the module - the module standard keeps environment reading in the app, and
`env: []` stays true.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Option shape | `unidentified: "refuse" \| { key: string }`, default `"refuse"` | the issue's proposal; an object leaves room for more fields | issue |
| Key format | the bucket-name rule (lowercase, digits, `_ . -`, starts with a letter, at most 63) | a short, safe identifier part; the same rule the app already knows | plan |
| Client key | `unidentified:<key>` | never collides with `ip:` or `subject:` keys, and a row in the table says what it is | plan |
| Return type | `identifyClient` stays `Ok<string> \| Err<"security.client_unidentified">` | callers need no change | plan |
| Version | no bump | releases are the owner's (`release.owner: true`) | workflow.json |

## Phase 1: the `unidentified` option and the README

**Discipline:** TDD. **Files:** `modules/security/src/options.ts`, `modules/security/src/server/identify.ts`,
`modules/security/tests/identify.test.ts`, `modules/security/tests/module.test.ts`, `modules/security/README.md`

1. `tests/identify.test.ts`, `tests/module.test.ts`: the cases below, red first.
2. `src/options.ts`: `unidentified` in `securityOptionsSchema`, a union of the literal `"refuse"` and a strict
   object `{ key }` checked with the bucket-name rule, default `"refuse"`. Contract:
   `SecurityOptions["unidentified"]` is `"refuse" | { readonly key: string }`.
3. `src/server/identify.ts`: after the resolvers, return `ok("unidentified:<key>")` when the option is an object,
   else the error; the doc comment says the fallback is an explicit choice.
4. `README.md` §3: the option in the table; "Unidentified clients" replaces "Development without a proxy" and the
   `NODE_ENV` chain: the default, the shared key and why production refuses, the same-image example switched by
   `RATE_LIMIT_SHARED_FALLBACK` (and `NODE_ENV !== "production"` for `next dev`), the proxy warning; §4 table and
   §6 (the module reads no variable; the switch is the app's).

**Tests:** default is `"refuse"` (the defaults test); an unidentified request with `{ key: "test-stack" }` →
`ok("unidentified:test-stack")`; a resolver match still wins over the fallback; `"refuse"` explicit → error; an
invalid key (`"Test Stack"`, empty) and an unknown field in the object are refused at startup with the message.

**Done when:**
- Automated: the new tests fail before the implementation and pass after; Gates green (typecheck, lint, test).
- Manual: the README example reads correctly for both stacks (verified by agent when the snippet type-checks
  against the package in a scratch file).

## Risks and rollback

- An app sets the fallback in production by mistake: one shared bucket for unidentified traffic, which is what it
  already has today with `() => "0.0.0.0"`. The README says to set the switch on the test stack only.
- Rollback: revert the phase commit; the default never changed, so apps without the option are unaffected.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: the `unidentified` option and the README

#### Automated
- [x] 1.1 New tests fail before the implementation and pass after
- [x] 1.2 Gates green (typecheck, lint, test)

#### Manual
- [x] 1.3 README example reads correctly for both stacks (verified by agent: the §3 snippet, run as a scratch Vitest test against the package, typechecks and identifies `ip:` with CF-Connecting-IP, `unidentified:test-stack` with the switch or under development, and refuses otherwise)
