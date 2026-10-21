# @softure-ai/security

Rate limits for public entry points, a client-IP resolver that matches the app's hosting, and a
size-capped request body reader. Built from FIRE_TRACKER's limiter (`src/db/auth-attempts.ts`,
`src/lib/read-small-body.ts`); the difference is that a client whose address cannot be resolved is
refused by default instead of sharing one bucket with every other such client (§3, `unidentified`).

## 1. What it provides

Fixed-window rate limits in Postgres with buckets from configuration, pluggable client-IP
resolvers and `readSmallBody`, so every public route and server action can refuse floods before
they cost anything. Webhook-style endpoints read the raw body with `readSmallBodyBytes` and check a
shared-secret signature with `verifySignedRequest`; the sender signs with `signRequestBody` (§4,
"Signed requests"). Webhooks from third-party products (a code host, a shop, a payment provider) are checked in the
provider's own format with `verifyWebhookSignature`, and their retries are skipped with `recordDeliveryOnce` (§4,
"Third-party webhooks"). A request to a URL someone else chose goes through `sendGuardedRequest`, which refuses
private and other non-public targets (§4, "Requests to third-party URLs"); a page behind such a URL is fetched with
`fetchGuardedPage` and turned into plain text with `htmlToReadableText` (§4, "Fetching a page").

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
| `webhookDeliveries` | `{ retentionDays?: number }` (1-365) | `{ retentionDays: 30 }` | How long a webhook delivery id is kept (`recordDeliveryOnce`); keep it past the provider's retry window. |

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

### Signed requests

An endpoint called by a machine you control (an edge worker that forwards mail, a CI callback, a
provider without its own SDK) authenticates the call with a shared secret: the sender sends an
HMAC-SHA256 of `"<unix seconds>.<body>"` in a header, `t=<seconds>,v1=<64 hex>`, and the app checks it
within a freshness window. The header name is the app's choice.

```ts
import { readSmallBodyBytes, verifySignedRequest } from "@softure-ai/security";

export async function POST(request: Request): Promise<Response> {
  const body = await readSmallBodyBytes(request, { maxBytes: 5 * 1024 * 1024 });
  if (!body.ok) return Response.json({ error: body.error }, { status: body.error === "security.body_too_large" ? 413 : 400 });

  const signed = await verifySignedRequest({
    secret: process.env.INBOUND_MAIL_SECRET,
    header: request.headers.get("x-signature"),
    body: body.value,
    now: new Date(),
  });
  if (!signed.ok) return Response.json({ error: signed.error }, { status: 401 });
  // … parse body.value (raw bytes: a MIME message keeps its own charset)
}
```

The sender, for example a Cloudflare Worker, imports the signer from the side-effect-free entry
`@softure-ai/security/signed-request` (Web Crypto only, no module factory):

```ts
import { signRequestBody } from "@softure-ai/security/signed-request";

const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
const signature = await signRequestBody({ secret: env.INBOUND_MAIL_SECRET, body: raw, now: new Date() });
await fetch(env.APP_INBOUND_URL, { method: "POST", body: raw, headers: { "x-signature": signature } });
```

| Function (`@softure-ai/security`) | Returns |
| --- | --- |
| `readSmallBodyBytes(request, { maxBytes })` | `Ok<Uint8Array>` (the bytes as sent), `Err<"security.body_too_large">` or `Err<"security.body_unreadable">` |
| `signRequestBody({ secret, body, now })` | `t=<seconds>,v1=<hex>`, one `v1` per secret; throws on a secret under `MIN_SIGNING_SECRET_LENGTH` (32) characters |
| `verifySignedRequest({ secret, header, body, now, toleranceSeconds? })` | `Ok<undefined>` or `Err<"security.signature_invalid">` |

**Fails closed.** A missing, empty or short secret, a missing or malformed header (no `t`, a repeated
`t`, no well-formed `v1`), a timestamp more than `toleranceSeconds` (default
`SIGNED_REQUEST_TOLERANCE_SECONDS`, 300) from `now` in either direction, and a wrong MAC all give
`security.signature_invalid`. MACs are compared in constant time. Verify the exact bytes received,
before decoding or parsing them.

**Rotating a secret.** Both sides take one secret or a list. Deploy the receiver with
`[newSecret, oldSecret]`, then switch the sender to `newSecret` (or let it sign with both, which
writes one `v1` per secret), then drop `oldSecret` from the receiver.

### Third-party webhooks

A webhook from a product you do not control is signed in that product's format: an HMAC of the raw request body
under a secret the provider issued, written in hex or base64 in a header of its own, sometimes behind a prefix, with
no timestamp. `verifyWebhookSignature` checks any such format; the format is three values, not a provider SDK.

```ts
import { readSmallBodyBytes, verifyWebhookSignature } from "@softure-ai/security";
import { recordDeliveryOnce } from "@softure-ai/security/server";

export async function POST(request: Request): Promise<Response> {
  const body = await readSmallBodyBytes(request, { maxBytes: 1024 * 1024 });
  if (!body.ok) return Response.json({ error: body.error }, { status: body.error === "security.body_too_large" ? 413 : 400 });

  const signed = await verifyWebhookSignature({
    secret: process.env.GITHUB_WEBHOOK_SECRET,
    header: request.headers.get("x-hub-signature-256"),
    body: body.value,
    algorithm: "sha256",
    encoding: "hex",
    prefix: "sha256=",
  });
  if (!signed.ok) return Response.json({ error: signed.error }, { status: 401 });

  const event: unknown = JSON.parse(new TextDecoder().decode(body.value));
  return db.transaction(async (tx) => {
    const delivery = await recordDeliveryOnce(
      { db: tx, clock: systemClock, config },
      { source: "github", deliveryId: request.headers.get("x-github-delivery") ?? "" },
    );
    if (!delivery.ok) return Response.json({ error: delivery.error }, { status: 400 });
    if (!delivery.value) return new Response(null, { status: 200 }); // a retry: already done
    // … the work, with tx
    return new Response(null, { status: 200 });
  });
}
```

**Presets.** The formats of a few common senders, from their public documentation; check the provider's current
docs when adding one.

| Sender | Signature header | `algorithm` | `encoding` | `prefix` | Delivery id header |
| --- | --- | --- | --- | --- | --- |
| GitHub | `X-Hub-Signature-256` | `"sha256"` | `"hex"` | `"sha256="` | `X-GitHub-Delivery` |
| GitHub, legacy | `X-Hub-Signature` | `"sha1"` | `"hex"` | `"sha1="` | `X-GitHub-Delivery` |
| Shopify | `X-Shopify-Hmac-Sha256` | `"sha256"` | `"base64"` | none | `X-Shopify-Webhook-Id` |
| Lemon Squeezy | `X-Signature` | `"sha256"` | `"hex"` | none | none: deduplicate on an id in the verified payload |

A sender that signs `"<timestamp>.<body>"` and writes `t=<seconds>,v1=<hex>` (Stripe's `Stripe-Signature`) already
matches `verifySignedRequest` (§4, "Signed requests"), which also bounds the timestamp.

| Function | Returns |
| --- | --- |
| `verifyWebhookSignature({ secret, header, body, algorithm, encoding, prefix? })` (`@softure-ai/security` and `/signed-request`) | `Ok<undefined>` or `Err<"security.signature_invalid">` |
| `signWebhookBody({ secret, body, algorithm, encoding, prefix? })` (same entries) | the header value the provider would send, for tests of a handler |
| `recordDeliveryOnce(ctx, { source, deliveryId })` (`/server`) | `Ok<true>` the first time, `Ok<false>` for a replay, or `Err<"security.delivery_id_invalid">` |
| `forgetDelivery(ctx, { source, deliveryId })` (`/server`) | forgets one delivery, so the next retry is processed |
| `pruneWebhookDeliveries(ctx)` (`/server`) | deletes ids older than `webhookDeliveries.retentionDays` |

**Fails closed.** A missing or empty secret (also one empty entry of a list), a missing header, a missing or
different prefix (matched exactly, case included), a MAC that is not exactly one digest in the encoding (hex in
either case; standard base64, padding optional, no base64url) and a wrong MAC all give `security.signature_invalid`.
MACs are compared as bytes in constant time. The secret is used as its UTF-8 bytes, the way these providers sign;
unlike `verifySignedRequest`, no minimum length is enforced, since the provider chose it. Secret lists rotate as in
"Signed requests". Verify the bytes received: parsed and re-serialised JSON does not match.

**Replays.** These signatures carry no timestamp, so a captured request verifies forever. Providers retry a
delivery with the same id until they get a 2xx, and `recordDeliveryOnce` turns every repeat into `Ok<false>`: answer
200 and skip the work. The record is one `INSERT … ON CONFLICT DO NOTHING`, so of two parallel retries exactly one is
first. Record it in the work's transaction (above): when the work fails, the record rolls back and the provider's
retry is processed. When the work cannot share the transaction, record first and call `forgetDelivery` when the work
fails. `source` is the app's constant name for the sender (the bucket name rule; a malformed one throws), so two
providers' ids never collide; a `deliveryId` that is empty, longer than 200 characters or holds control characters
is `security.delivery_id_invalid`. Ids are kept for `webhookDeliveries.retentionDays` (default 30 days, well past
every retry window), then pruned (§11): a replay older than that is accepted again.

### Requests to third-party URLs

Some requests go to a URL the app did not choose: an RFC 8058 one-click unsubscribe address from a received
mail, a webhook target a user typed, a link preview. Sent with plain `fetch`, such a URL can point the server
at itself, the private network or a cloud metadata endpoint (SSRF). `sendGuardedRequest` from
`@softure-ai/security/server` (Node only) sends the request only to public addresses and returns nothing but
the status:

```ts
import { sendGuardedRequest } from "@softure-ai/security/server";

const sent = await sendGuardedRequest(listUnsubscribeUrl, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "List-Unsubscribe=One-Click",
  timeoutMs: 5000,
});
if (!sent.ok) return markUnsubscribeFailed(sent.error);
const delivered = sent.value.status >= 200 && sent.value.status < 300;
```

| Function (`@softure-ai/security/server`) | Returns |
| --- | --- |
| `sendGuardedRequest(url, { method, headers?, body?, timeoutMs, allowedPorts? }, seam?)` | `Ok<{ status }>`, or `Err` with `security.outbound_invalid_url`, `security.outbound_blocked`, `security.outbound_timeout` or `security.outbound_failed` |
| `isPublicAddress(address)` | `true` for a public IPv4 or IPv6 address; `false` for special-purpose ranges and anything that is not an address |

**What is refused.** `security.outbound_invalid_url`: a URL that does not parse, a scheme other than `http:`
or `https:`, credentials in the URL. `security.outbound_blocked`: a port outside `allowedPorts` (default
`[443]`, so plain `http:` on port 80 needs an explicit `[80, 443]`); an IP literal that is not public (`[::1]`,
`[::ffff:127.0.0.1]`, `0x7f.1`); a host name with **any** resolved address that is not public. Not public are the
RFC 6890 special-purpose ranges: loopback, private, link-local (cloud metadata), carrier-grade NAT,
benchmarking, documentation, multicast and reserved IPv4; for IPv6 everything outside global unicast
`2000::/3` (loopback, ULA, link-local, multicast, NAT64, IPv4-mapped and -compatible) plus Teredo and the IETF
block, 6to4 and documentation.

**How it holds.** The address check runs in the socket's own `lookup`, so the address checked is the address
connected to and a DNS answer cannot change in between (rebinding). It resolves every address and answers in
the shape Node asks for (a list when `autoSelectFamily` is on). `agent: false` keeps a pooled socket from
skipping the lookup. Redirects are not followed (a 3xx comes back as its status), one timer covers the whole
exchange up to the status, and the response is closed as soon as its status arrives.

**Testing against a fake server.** The third argument replaces the transport, the address rule and the
resolver, so a test can reach a server on loopback:

```ts
const result = await sendGuardedRequest(`http://unsubscribe.test:${port}/`, { method: "POST", timeoutMs: 2000, allowedPorts: [port] }, {
  isAllowedAddress: (address) => address === "127.0.0.1",
  resolveHost: (_host, _family, done) => done(null, [{ address: "127.0.0.1", family: 4 }]),
});
```

### Fetching a page

A saved link, a link preview or a "summarize this page" feature needs the page itself. `fetchGuardedPage` sends a
GET with the same guard on every hop: the first URL and each redirect's `Location` (resolved against the hop it came
from) pass the URL checks above and are resolved through the guarded lookup again, so a short link cannot redirect
the server to `169.254.169.254` or a host that resolves to the private network. One timer covers every hop and the
body, and the body is cut at `maxBytes` after `content-encoding` (gzip, deflate, brotli) is undone, so a small
compressed answer cannot expand past the cap.

```ts
import { htmlToReadableText } from "@softure-ai/security/readable-text";
import { fetchGuardedPage } from "@softure-ai/security/server";

const fetched = await fetchGuardedPage(savedLink.url, { timeoutMs: 10_000, maxBytes: 2_000_000 });
if (!fetched.ok) return markPreviewFailed(fetched.error);
const { status, finalUrl, contentType, charset, body } = fetched.value;
if (status !== 200 || contentType !== "text/html") return markPreviewFailed("not_a_page");
const html = new TextDecoder(charset ?? "utf-8").decode(body); // an unknown label throws a RangeError
const { title, description, text, links } = htmlToReadableText(html, { baseUrl: finalUrl });
```

| Function | Returns |
| --- | --- |
| `fetchGuardedPage(url, { timeoutMs, maxBytes, maxRedirects?, accept?, userAgent?, allowedPorts?, allowTruncation? }, seam?)` (`@softure-ai/security/server`) | `Ok<{ status, finalUrl, contentType, charset, body: Uint8Array, truncated }>`, or `Err` with the `security.outbound_*` codes above or `security.outbound_too_large` |
| `htmlToReadableText(html, { baseUrl })` (`@softure-ai/security/readable-text`) | `{ title, description, text, links: { text, url }[] }`; no network, no script |

**Options.** `maxRedirects` defaults to 5 (more hops is `security.outbound_failed`; `0` returns a 3xx as the page).
`allowedPorts` defaults to `[80, 443]`, since plain `http:` links are common and the guard holds on any port; every
hop must stay inside it. `accept` defaults to HTML first, `userAgent` to `GUARDED_PAGE_USER_AGENT`. A body longer than
`maxBytes` comes back cut with `truncated: true`, or as `security.outbound_too_large` with `allowTruncation: false`.

**What comes back.** Any status, a 404 or a 500 included, is `Ok` with its body: the caller decides. `contentType`
is the media type in lowercase without parameters; `charset` is the declared label (the `content-type` parameter,
else for HTML a `<meta charset>` or `http-equiv` in the first 1024 bytes) or `null`. Decoding stays with the caller.
An encoding the fetch cannot undo, or a body that does not decode, is `security.outbound_failed`.

**Readable text.** `htmlToReadableText` lives in its own entry point, `@softure-ai/security/readable-text`, so
`/server` does not load the HTML parser for an app that never uses it; it runs anywhere, not only on Node. It parses the HTML into a static tree (`node-html-parser`): no script runs and
nothing is loaded. The title is `<title>`, else `og:title`, else the first `h1`; the description is the meta
description, else `og:description` (a video page often has nothing else). The text is `main` (else `body`), narrowed
to its only `article`, without scripts, styles, navigation, forms, asides, hidden nodes and the page's own header and
footer; blocks become paragraphs, list items `- ` or `1. ` lines, `pre` keeps its lines. Links stay as their text,
and `links` lists the absolute `http:`/`https:` URLs once each (resolved on `<base>`, else `baseUrl`), without
`mailto:`, `javascript:` and links to a place on the same page.

## 5. Migrations and tables

Schema `security`, two migrations:

| Migration | Creates |
| --- | --- |
| `0001_create_rate_limits.sql` | `security.rate_limits(bucket, identifier, attempts, window_started_at)`, primary key `(bucket, identifier)`, an index on `window_started_at` |
| `0002_create_webhook_deliveries.sql` | `security.webhook_deliveries(source, delivery_id, received_at)`, primary key `(source, delivery_id)`, an index on `received_at` |

Constraints: the bucket name format, an identifier of 1 to 200 characters, `attempts >= 1`. Each
attempt is one `INSERT … ON CONFLICT DO UPDATE`, so parallel requests cannot both slip under the
limit; the counter stops at `limit + 1`. The table holds one row per bucket and key, whatever the
number of attempts. `webhook_deliveries` checks the source name format and a delivery id of 1 to 200 characters
without control characters. Run `softure migrate` after enabling the module and after upgrading to a version with a
new migration.

## 6. Environment variables

None. A deploy-time switch for the shared fallback (§3) is the app's own variable.

## 7. Switches

None.

## 8. Appearance

No UI. Show the error codes through your own forms with the copy below.

## 9. Copy

`errors.rate_limited`, `errors.client_unidentified`, `errors.body_too_large`,
`errors.body_unreadable`, `errors.signature_invalid`, `errors.delivery_id_invalid` and the `errors.outbound_*` keys in
`src/messages/en.ts`, one per error code
(`security.<key>`). Override them per locale: `security({ …, messages: { en: { errors: { rate_limited: "…" } } } })`.

## 10. Hooks

None. Custom client-IP resolvers are plain functions (section 3).

## 11. GDPR

The table holds rate limit keys only: client addresses (personal data) and SHA-256 prefixes of
subjects, never an email in clear text (`listRateLimitBuckets` names the buckets keyed by address). Nothing is
exported per user. Cleanup deletes a row two windows after its window started; it runs on a share
of consumed attempts (`cleanupProbability`), so with little traffic a row can stay longer. Schedule
`pruneRateLimits` (for example hourly) when the retention period must be guaranteed.

`webhook_deliveries` holds a provider's delivery ids and when they arrived, no request content and no personal data.
Rows older than `webhookDeliveries.retentionDays` are deleted by `pruneWebhookDeliveries`; nothing calls it on its
own, so schedule it (daily is enough).

**With `@softure-ai/jobs`.** `@softure-ai/security/jobs` ships the handler and the schedule, so the worker runs the
cleanups instead of an app cron (`security.prune-rate-limits` hourly, `security.prune-webhook-deliveries` daily; jobs
README, "Schedules"):

```ts
// softure.config.ts
jobs({ schedules: { ...securityJobSchedules } }),
// src/jobs/handlers.ts (the worker's handlers)
export const handlers: JobHandlers = { ...securityJobHandlers /* , the app's own */ };
```

`@softure-ai/jobs` is an optional peer: an app without it calls `pruneRateLimits` and `pruneWebhookDeliveries` from
its own cron.

## 12. Limitations

- Fixed windows: a client can make up to twice the limit across a window boundary. Good enough to
  stop floods, not to share capacity fairly.
- Postgres only; there is no in-memory or Redis backend.
- No Next.js adapter yet: the route handler and server action shapes come with identity ID-1.
- Cleanup is probabilistic; a deployment with very little traffic may keep expired rows until the
  next cleanup or a scheduled `pruneRateLimits`.
- Signed requests stop forgery and replay outside the window, not a replay inside it: an endpoint
  whose effect must happen once also deduplicates by a message id (`recordDeliveryOnce`).
- `verifyWebhookSignature` covers HMACs over the raw body. Formats that sign more than the body (a URL and form
  fields, an id and a timestamp joined with the body) or use public-key signatures need the provider's own check.
- The delivery ledger remembers ids for `webhookDeliveries.retentionDays`; a replay older than that is processed
  again.
- `sendGuardedRequest` returns the status only: no response body and no redirect following
  (`fetchGuardedPage` reads the body and follows redirects, GET only). Neither supports an outbound proxy: a request
  that must go through one needs its own client.
- `htmlToReadableText` reads the HTML as served; a page that renders its content with JavaScript has little text
  beyond its title and description.

## Build

`npm run build -w modules/security` runs `tsc -p tsconfig.build.json`. Tests: `npm test` at the
repository root (PGlite, no server needed).
