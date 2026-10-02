# Plan: security-rate-limit

Input: change.md, research.md. Complexity: medium (3 phases).

## Goal

`@softure-ai/security` (`modules/security/`) is a workspace package that gives an app and other
modules:

- `security({ clientIp, buckets, ipv6Subnet?, cleanupProbability? })`, the module factory, with
  table `security.rate_limits(bucket, identifier, attempts, window_started_at)` and its migration;
- client-IP resolvers `cloudflareIp()`, `headerIp(name)`, `forwardedForIp({ trustedProxies })`
  and any `(headers) => string | null`; `clientIp` takes one or a list (first match wins);
- `@softure-ai/security/server`: `identifyClient(ctx, headers)`, `subjectKey(subject)`,
  `consumeRateLimit(ctx, { bucket, key })`, `resetRateLimit(ctx, { bucket, key })`,
  `pruneRateLimits(ctx)`;
- `readSmallBody(request, { maxBytes })`;
- pl + en messages for its four error codes, a README with the twelve sections.

Baseline: FIRE's `auth-attempts.test.ts` behaviours pass against the module, plus resolver,
key and body tests. The example app enables the module and an e2e proves it on `next start`.

**Out of scope:** a Next adapter (ID-1 decides its shape; the module needs none today), sliding
windows, a Redis backend, wiring auth (ID-3).

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Limiter | one `INSERT … ON CONFLICT DO UPDATE` with a `CASE` reset, counted before the work | atomic without a lock; FIRE's measured behaviour | research |
| Window | per bucket `windowMinutes`; expired when `window_started_at < now - window` | buckets from configuration | research |
| Attempts cap | `least(attempts + 1, limit + 1)` | a flood cannot overflow the column | research |
| Cleanup | per bucket, older than two windows; unknown buckets on the longest window; with probability `cleanupProbability` (default 0.01) per consume | FIRE lesson: pruning only on success never ran during a flood | research |
| Results | `consumeRateLimit` → `Ok<{ remaining, resetAt }>` or `Err<"security.rate_limited">` with `retryAfterSeconds` and `resetAt`; database errors propagate | expected failures are values; a caller wraps DB failures with `safeError` | AGENTS.md |
| Bugs | unknown bucket, module not enabled, empty or over-long key → thrown `Error` naming the input | programming errors, not expected failures | AGENTS.md |
| Client key | `ip:<normalised>`; IPv6 as its `/ipv6Subnet` network (default 64) | one subscriber owns a /64 | research |
| Subject key | `subject:<first 32 hex of sha256(subject)>`, never concatenated with the IP | answer 1; no clear-text emails in the table | research |
| Unidentified client | `identifyClient` → `Err<"security.client_unidentified">` | never a shared bucket (roadmap unknown 3) | research |
| `forwardedForIp` | `trustedProxies: n` (n-th from the right) or a list of addresses and CIDRs skipped from the right, through `node:net` `BlockList` | answer 2 | research |
| Body reader | `readSmallBody(request, { maxBytes })` → `Ok<string>` or `security.body_too_large` / `security.body_unreadable`; `content-length` first, then the counted stream, cancelled past the cap | FIRE behaviour, cap per call | research |
| Constraints | bucket name format, identifier length 1..200, attempts ≥ 1 as CHECKs; PK `(bucket, identifier)`; index on `window_started_at` | invariants as constraints | AGENTS.md |
| Migrations URL | `new URL("../migrations/", String(import.meta.url))` | Turbopack issue until ID-1 | change.md |

## Phase 1: Package, migration and limiter

- Copy `templates/package/` into `modules/security/` (keep `src/index.ts`, `src/contract.ts`,
  `src/messages/`, `src/server/`; drop `next/` and `ui/` placeholders and their exports), name it
  `@softure-ai/security`, dependencies `@softure-ai/core`, `@softure-ai/db`, `zod`, peer
  `drizzle-orm`; update the lockfile.
- `migrations/0001_create_rate_limits.sql`, `src/schema.ts` (Drizzle table).
- `src/options.ts` (zod schema, `ClientIpResolver`), `src/index.ts` (`security` via `defineModule`,
  `module.json` equal to `toModuleJson`).
- `src/server/rate-limit.ts`: `consumeRateLimit`, `resetRateLimit`, `pruneRateLimits`.
- Tests on PGlite: the FIRE baseline cases plus per-bucket windows, the attempts cap,
  `retryAfterSeconds`, cleanup on and off, unknown bucket and missing module throws, the
  migration's constraints.

## Phase 2: Client identification and body reader

- `src/client-ip.ts`: `normalizeIp`, `headerIp`, `cloudflareIp`, `forwardedForIp`.
- `src/server/identify.ts`: `identifyClient`, `subjectKey`.
- `src/read-small-body.ts`.
- Messages (`errors.rate_limited`, `client_unidentified`, `body_too_large`, `body_unreadable`) in
  `en` and `pl`; README with the twelve sections.
- Tests: resolvers (spoofed left entries, several proxies, CIDR lists, garbage, ports, IPv6 /64,
  IPv4-mapped), key building, body reader (exact cap, over cap by header and by stream, no body,
  unreadable stream).

## Phase 3: Example app and e2e

- Example app: dependency `@softure-ai/security`, the module entry in `softure.config.ts`, a route
  handler `app/api/security/ping/route.ts` that identifies the client, consumes bucket
  `example.ping` and reads a small body.
- `e2e/security.spec.ts`: three requests pass, the fourth gets 429 with `Retry-After`, another
  address still passes, a request without the header gets 400 `security.client_unidentified`, an
  oversized body gets 413. `e2e/migrations.spec.ts` lists the security migration.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Package, migration and limiter

#### Automated
- [x] 1.1 The FIRE baseline cases and the new limiter cases pass on PGlite — d4b9d65
- [x] 1.2 `module.json` equals `toModuleJson(security)` and the package passes `tests/repo/packages.test.ts` — d4b9d65
- [x] 1.3 `npm run build` emits `modules/security/dist/index.js` and `dist/server/index.js` — d4b9d65
- [x] 1.4 Gates green (typecheck, lint, test) — d4b9d65

### Phase 2: Client identification and body reader

#### Automated
- [x] 2.1 Resolver, key and body reader tests pass — d4b9d65
- [x] 2.2 pl and en dictionaries have the same keys and README links pass the link test — d4b9d65
- [x] 2.3 Gates green (typecheck, lint, test) — d4b9d65

### Phase 3: Example app and e2e

#### Automated
- [ ] 3.1 `npm run e2e` passes against a local PostgreSQL 16, including `security.spec.ts`
- [ ] 3.2 Gates green (typecheck, lint, test)
