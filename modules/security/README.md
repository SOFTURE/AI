# @softure-ai/security

Rate limits for public entry points, a client-IP resolver that matches the app's hosting, and a
size-capped request body reader. Built from FIRE_TRACKER's limiter (`src/db/auth-attempts.ts`,
`src/lib/read-small-body.ts`); the difference is that a client whose address cannot be resolved is
refused by default instead of sharing one bucket with every other such client (§3, `unidentified`).

## 1. What it provides

Fixed-window rate limits in Postgres with buckets from configuration, pluggable client-IP
resolvers and `readSmallBody`, so every public route and server action can refuse floods before
they cost anything.

## 2. Installation

```bash
npm install @softure-ai/security @softure-ai/core @softure-ai/db drizzle-orm
```

## 3. Configuration

```ts
import { defineSoftureConfig } from "@softure-ai/core";
import { cloudflareIp, security } from "@softure-ai/security";

export default defineSoftureConfig({
  // database, locale, timezone, appOrigin …
  modules: [
    security({
      clientIp: cloudflareIp(),
      buckets: {
        login: { limit: 50, windowMinutes: 15, key: "ip" },
        "login-account": { limit: 10, windowMinutes: 15, key: "account" },
        register: { limit: 5, windowMinutes: 15, key: "ip" },
      },
    }),
  ],
});
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `clientIp` | `ClientIpResolver \| ClientIpResolver[]` | required | Where the client address comes from; several are tried in order. |
| `buckets` | `Record<string, { limit: number; windowMinutes: number; key?: "ip" \| "account" \| "subject" }>` | required, at least one | Named limits: `limit` attempts per fixed window of `windowMinutes` (1 to 10080). Names are lowercase letters, digits, `_`, `.` and `-`. `key` says what the bucket counts by (below). |
| `unidentified` | `"refuse" \| { key: string }` | `"refuse"` | What happens to a request no resolver identifies: refused with `security.client_unidentified`, or counted under one shared key `unidentified:<key>` (the key follows the bucket name rule). |
| `ipv6Subnet` | `number` (1-128) | `64` | IPv6 clients are keyed by this network; one subscriber usually owns a whole /64. |
| `cleanupProbability` | `number` (0-1) | `0.01` | Chance that a consumed attempt also deletes expired rows. |

**What a bucket counts by.** `key` states the processing; the limiter itself does not read it. `"ip"`:
the client address (`identifyClient`), also when combined with another value; `"account"`: one account
(its user id or its login email); `"subject"`: any other value passed through `subjectKey` (an address
on a waitlist). Every bucket default a package exports (`AUTH_RATE_LIMIT_BUCKETS` and the others)
declares it. `listRateLimitBuckets(config)` from `@softure-ai/security/server` lists the configured
buckets with `name`, `limit`, `windowMinutes` and `key` (`undefined` when a definition leaves it out),
so the privacy policy's list of IP-keyed processing comes from the config instead of a hand-kept copy:

```ts
const ipKeyed = listRateLimitBuckets(config).filter((bucket) => bucket.key === "ip").map((bucket) => bucket.name);
```

**Changing one threshold.** `overrideBuckets(defaults, overrides)` returns a copy of a package's
defaults with the named fields changed; the rest of each bucket, its `key` included, stays. A name the
defaults lack is a type error and throws, so a typo never adds a bucket nothing counts in.

```ts
buckets: { ...overrideBuckets(AUTH_RATE_LIMIT_BUCKETS, { login: { limit: 500 } }), ...WAITLIST_RATE_LIMIT_BUCKETS },
```

**Resolvers.** Pick the one that matches what stands in front of the app; trusting a header the
edge does not set or overwrite lets any client choose its own key.

| Resolver | Reads | Use when |
| --- | --- | --- |
| `cloudflareIp()` | `CF-Connecting-IP` | the origin accepts traffic from Cloudflare only |
| `forwardedForIp({ trustedProxies: 1 })` | `X-Forwarded-For`, n-th entry from the right | a known number of proxies (Traefik, nginx, a load balancer) append to the header |
| `forwardedForIp({ trustedProxies: ["10.0.0.0/8"] })` | `X-Forwarded-For`, first entry from the right that is not a trusted proxy | the proxies have known addresses or ranges |
| `headerIp("x-real-ip")` | a header holding one address | the edge overwrites that header |
| `(headers) => string \| null` | anything | your own; the result is normalised, and a value that is not an address counts as no match |

Entries left of the trusted proxies' entries came from the client and are never used. A missing,
short or garbled header resolves to nothing. Addresses are normalised: a port and IPv6 brackets are
removed, IPv4-mapped (and the deprecated IPv4-compatible) IPv6 becomes IPv4, IPv6 is written in full lowercase groups.

**Unidentified clients.** A request that no resolver identifies is refused by default
(`security.client_unidentified`): in production that means the edge was bypassed, and counting all
such requests in one bucket would let one client lock out all the others. A stack with no edge in
front (`next dev`, an integration stack behind a proxy only) has no header to read, so every request
there is unidentified. For such a stack, choose a shared fallback explicitly with
`unidentified: { key: "local" }`: every unidentified request is then counted under
`unidentified:local`, while a request a resolver does identify keeps its own `ip:` key. That is what a
single developer or a test runner wants, and exactly what production must not do, so keep it out of
the production configuration. A test suite that logs in many times from one stack raises the `login`
bucket (auth README §3).

**One image, several stacks.** `NODE_ENV` cannot tell production from a test stack that runs the
same production image (`NODE_ENV=production` in both). Switch the fallback at deploy time instead:
an environment variable set on the test stack only, read by the app's own config.

```ts
// RATE_LIMIT_SHARED_FALLBACK=1 is set on the integration stack only (no Cloudflare in front).
// `next dev` runs with NODE_ENV=development and needs the fallback as well.
const hasSharedFallback =
  process.env.RATE_LIMIT_SHARED_FALLBACK === "1" || process.env.NODE_ENV !== "production";

security({
  clientIp: cloudflareIp(),
  unidentified: hasSharedFallback ? { key: "test-stack" } : "refuse",
  buckets: { ...AUTH_RATE_LIMIT_BUCKETS },
});
```

Production behind Cloudflare keys every request by `CF-Connecting-IP`; the test stack and `next dev`
send no such header and share one bucket. The module itself reads no environment variable (§6).

**Proxy headers behind Cloudflare.** Behind Cloudflare and a proxy (Cloudflare → Traefik, nginx or a
load balancer), the right end of `X-Forwarded-For` and `X-Real-IP` hold the address of the
Cloudflare edge that forwarded the request, not the client's. A resolver list whose first match is
`forwardedForIp(…)` or `headerIp("x-real-ip")` then puts every visitor of one edge into one bucket.
Behind Cloudflare, `cloudflareIp()` is the resolver that sees the client. Use the proxy resolvers
only on a stack where that proxy is the first thing in front of the app, never in a configuration
that also runs behind Cloudflare.

## 4. Mounting

Nothing to mount: the module has no routes or pages. Call it from your route handlers and server
actions, before the work it guards:

```ts
import { readSmallBody } from "@softure-ai/security";
import { consumeRateLimit, identifyClient } from "@softure-ai/security/server";

export async function POST(request: Request): Promise<Response> {
  const ctx = { db, clock: systemClock, config };
  const client = identifyClient(ctx, request.headers);
  if (!client.ok) return Response.json({ error: client.error }, { status: 400 });

  const limit = await consumeRateLimit(ctx, { bucket: "beacon", key: client.value });
  if (!limit.ok) {
    return Response.json({ error: limit.error }, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  }

  const body = await readSmallBody(request, { maxBytes: 256 });
  if (!body.ok) return Response.json({ error: body.error }, { status: body.error === "security.body_too_large" ? 413 : 400 });
  // … the work
}
```

In a server action, pass `await headers()` from `next/headers` to `identifyClient`.

| Function (`@softure-ai/security/server`) | Returns |
| --- | --- |
| `identifyClient(ctx, headers)` | `Ok<"ip:…">`, `Ok<"unidentified:<key>">` with a shared fallback, or `Err<"security.client_unidentified">` |
| `subjectKey(subject)` | `"subject:<32 hex of sha256>"`, a key for an email or a user id |
| `consumeRateLimit(ctx, { bucket, key })` | `Ok<{ remaining, resetAt }>` or `Err<"security.rate_limited">` with `retryAfterSeconds` and `resetAt` |
| `resetRateLimit(ctx, { bucket, key })` | forgets a key's attempts, e.g. after a successful login |
| `pruneRateLimits(ctx)` | deletes rows two windows after they started |

**Key by address and by subject separately.** A login that should stop both a flood from one
address and a distributed attack on one account consumes two buckets: `login` with the client key
and `login-account` with `subjectKey(email)`. Never glue them into one key (`ip|email`): a flood
then gets a fresh bucket per email.

**Failures.** Rate limits and body errors are values. An unknown bucket, an empty or over-long key
(over 200 characters) and calling the functions when the module is not enabled throw: they are bugs.
Database errors propagate; wrap the call like any query and answer with `safeError` from
`@softure-ai/core`, so no SQL reaches the client.

## 5. Migrations and tables

Schema `security`, one migration:

| Migration | Creates |
| --- | --- |
| `0001_create_rate_limits.sql` | `security.rate_limits(bucket, identifier, attempts, window_started_at)`, primary key `(bucket, identifier)`, an index on `window_started_at` |

Constraints: the bucket name format, an identifier of 1 to 200 characters, `attempts >= 1`. Each
attempt is one `INSERT … ON CONFLICT DO UPDATE`, so parallel requests cannot both slip under the
limit; the counter stops at `limit + 1`. The table holds one row per bucket and key, whatever the
number of attempts. Run `softure migrate` after enabling the module.

## 6. Environment variables

None. A deploy-time switch for the shared fallback (§3) is the app's own variable.

## 7. Switches

None.

## 8. Appearance

No UI. Show the error codes through your own forms with the copy below.

## 9. Copy

`errors.rate_limited`, `errors.client_unidentified`, `errors.body_too_large`,
`errors.body_unreadable` in `src/messages/en.ts` and `src/messages/pl.ts`, one per error code
(`security.<key>`). Override them per locale: `security({ …, messages: { en: { errors: { rate_limited: "…" } } } })`.

## 10. Hooks

None. Custom client-IP resolvers are plain functions (section 3).

## 11. GDPR

The table holds rate limit keys only: client addresses (personal data) and SHA-256 prefixes of
subjects, never an email in clear text (`listRateLimitBuckets` names the buckets keyed by address). Nothing is
exported per user. Cleanup deletes a row two windows after its window started; it runs on a share
of consumed attempts (`cleanupProbability`), so with little traffic a row can stay longer. Schedule
`pruneRateLimits` (for example hourly) when the retention period must be guaranteed.

## 12. Limitations

- Fixed windows: a client can make up to twice the limit across a window boundary. Good enough to
  stop floods, not to share capacity fairly.
- Postgres only; there is no in-memory or Redis backend.
- No Next.js adapter yet: the route handler and server action shapes come with identity ID-1.
- Cleanup is probabilistic; a deployment with very little traffic may keep expired rows until the
  next cleanup or a scheduled `pruneRateLimits`.

## Build

`npm run build -w modules/security` runs `tsc -p tsconfig.build.json`. Tests: `npm test` at the
repository root (PGlite, no server needed).
