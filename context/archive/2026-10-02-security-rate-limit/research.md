# Research: security-rate-limit

Input: change.md. Sources: FIRE_TRACKER (read-only clone), `foundation/core`, `foundation/db`,
`examples/next-app`, docs/02.

## Current state

- `modules/security/` is a stub: README (status "not implemented") and empty `src/{server,next,ui,messages}`,
  `migrations/`, `tests/` folders. It is not a workspace yet (no `package.json`).
- Module contract: `defineModule` (`foundation/core/src/module.ts`) parses options with the
  module's zod schema, freezes them, and requires `migrations.dir` when `dbSchema` is set.
  Server code gets `ModuleContext { db, clock, config }` (docs/02 §9); `getModule(config, id)`
  finds the enabled module and its parsed `options`.
- Migrations: `@softure-ai/db` runs each file inside the module schema
  (`SET LOCAL search_path TO <schema>, public`), names `NNNN_<snake>.sql`, a leading comment with
  `Rollback:`. Tests: `createTestDatabase([module])` from `@softure-ai/db/testing` (PGlite,
  per-worker template).
- The example app (`examples/next-app`) installs packed packages, migrates with `softure migrate`
  and runs Playwright in CI against Postgres 16. `e2e/migrations.spec.ts` asserts the exact list of
  ledger rows, so enabling a new module there changes that list.

## FIRE_TRACKER sources

- `src/db/auth-attempts.ts`: `recordAttempt(bucket, identifier, db, now)` is one
  `INSERT … ON CONFLICT (bucket, identifier) DO UPDATE` whose `CASE` resets `attempts` and
  `window_started_at` when the window expired; counts **before** the work; prunes rows older than
  two windows with probability 0.01 on every call (pruning only after a successful login never ran
  during a distributed flood); `clearAttempts` after a successful login. Limits are a const map
  (`register` 5, `login` 50, `mcp` 200, `waitlist` 8) with one 15-minute window.
- `src/db/auth-attempts.test.ts`: the behaviour baseline (allow up to the limit and reject the next,
  per identifier, per bucket, window reset, one row per key, clear, opportunistic prune, prune keeps
  fresh rows).
- `rateLimitKey` (`src/app/actions/do-auth.ts:154`): `cf-connecting-ip`, else the constant
  `"bez-cloudflare"`: every client without the header shares one bucket. The MCP route has a second
  copy. Password change keys on `zmiana-hasla:<userId>`, a subject instead of an address.
- `src/lib/read-small-body.ts`: rejects on `content-length` over the cap, then reads the stream and
  cancels it once the cap is passed; a read error returns `null`. The cap is a module constant (256).

## Answers to the roadmap unknowns

1. **IP only or IP + subject?** Neither concatenation. The client key is the IP alone, and a
   subject (an email, a user id) is a separate key in its own bucket. `ip|email` is weaker than
   both: a flood rotates emails and gets a fresh bucket each time, while a distributed attack on
   one account rotates IPs. A login that wants both consumes two buckets (`login` by IP,
   `login-account` by subject). Subjects are stored as a SHA-256 prefix, not in clear text.
2. **Several proxies.** `X-Forwarded-For` is appended by each proxy, so only the right end is
   trustworthy. `forwardedForIp({ trustedProxies: n })` takes the n-th entry from the right (the
   address the outermost trusted proxy saw); `trustedProxies: ["10.0.0.0/8", …]` skips trusted
   addresses from the right and takes the first one that is not. A missing, short or garbled
   header resolves to nothing, never to a spoofable left entry.
3. **No resolver match.** `identifyClient` returns the error `security.client_unidentified`; the
   caller refuses the request (fail closed) instead of counting it in a shared bucket. A request
   that carries a subject can still be limited on the subject. Development without a proxy passes
   an explicit custom resolver.

Extra findings:
- IPv6: one subscriber usually owns a whole /64, so keying on the full address lets a single
  client rotate through 2^64 buckets. Addresses are normalised (IPv4-mapped IPv6 → IPv4, ports and
  brackets stripped) and IPv6 is keyed by its /64 by default (option `ipv6Subnet`).
- `node:net` has `isIP` and `BlockList` (CIDR checks for IPv4 and IPv6), so no dependency is needed.
- Buckets from configuration can have different windows, so pruning works per bucket
  (`window_started_at < now - 2 × window`), with rows of buckets no longer configured pruned on the
  longest window.

## Risks

- A test of probabilistic cleanup is flaky by construction; the probability is an option
  (`cleanupProbability`), so tests set 1 or 0.
- `attempts` grows on every rejected request of a flood; capping at `limit + 1` keeps the column
  far from integer overflow.
- Adding the module to the example app changes the exact ledger list in `e2e/migrations.spec.ts`
  (an FD-7 file); the expected list gains one row.
