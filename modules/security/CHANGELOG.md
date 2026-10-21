# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/security`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`security@x.y.z`).

## Unreleased

- `fetchGuardedPage(url, { timeoutMs, maxBytes, maxRedirects?, accept?, userAgent?, allowedPorts?, allowTruncation? },
  seam?)` in `@softure-ai/security/server` (#636): a GET of a page at a URL someone else chose (saved links, link
  previews, page summaries). Redirects are followed (default 5) and every hop goes through the same checks as
  `sendGuardedRequest`, the guarded lookup included; one time limit covers the whole fetch; the body comes back as a
  `Uint8Array` capped at `maxBytes` after gzip, deflate or brotli is undone, with `status`, `finalUrl`, `contentType`,
  `charset` and `truncated`. Default ports `[80, 443]`. New code `security.outbound_too_large` (with
  `allowTruncation: false`; English message added, an app with its own translation adds `errors.outbound_too_large`).
- `htmlToReadableText(html, { baseUrl })` in the new entry point `@softure-ai/security/readable-text` (#636): the page's `title`, `description`,
  main text and absolute links, with no network and no script. New dependency `node-html-parser`.
- Nothing to migrate: `sendGuardedRequest` behaves as before.

## 0.2.3

- `sendGuardedRequest(url, { method, headers?, body?, timeoutMs, allowedPorts? }, seam?)` and `isPublicAddress(address)`
  in `@softure-ai/security/server` (#479): a request to a URL someone else chose (RFC 8058 one-click unsubscribe,
  webhook targets, link previews) that refuses non-public targets. Every resolved address is checked inside the
  socket's lookup (no DNS rebinding window, `{ all: true }` answered as a list), IP literals are checked before
  connecting, `agent: false`, no redirects, one time limit, the status only. RFC 6890 special-purpose ranges for IPv4
  and IPv6 are refused, IPv4-mapped IPv6 included. New codes `security.outbound_invalid_url`,
  `security.outbound_blocked`, `security.outbound_timeout`, `security.outbound_failed` (English messages added; an app
  with its own translation adds `errors.outbound_*`).
- Migrate an app that keeps its own guard: replace its outbound call with `sendGuardedRequest` (pass
  `allowedPorts` if it accepted ports other than 443), map the four codes onto its own outcomes, and switch its tests
  to the third argument (`isAllowedAddress`, `resolveHost`, `request`) to reach a fake server on loopback; then delete
  the local address list and lookup.

## 0.2.2

- `@softure-ai/security/jobs` (#491): `securityJobHandlers` and `securityJobSchedules` run `pruneRateLimits` hourly
  as a `@softure-ai/jobs` schedule; `@softure-ai/jobs` (^0.1.1) is a new optional peer. Migrate (optional): an app with
  `@softure-ai/jobs` adds `...securityJobSchedules` to `jobs({ schedules })` and `...securityJobHandlers` to its
  worker's handlers, then removes its own cron. Without jobs nothing changes.

## 0.2.1

- `readSmallBodyBytes(request, { maxBytes })`: the body as raw bytes with the same streaming cap as `readSmallBody`,
  for a body that is not UTF-8 (a raw MIME message in ISO-8859-2 or Windows-1250) and for verifying a signature over
  the exact bytes. `readSmallBody` is unchanged.
- `signRequestBody` and `verifySignedRequest` (#469): HMAC-SHA256 over `"<unix seconds>.<body>"`, header
  `t=<seconds>,v1=<hex>`, a freshness window (`toleranceSeconds`, default 300), constant-time comparison, several
  secrets or `v1` values for rotation; fails closed with the new code `security.signature_invalid` (English message
  added; an app with its own translation adds `errors.signature_invalid`). Web Crypto only; the new entry
  `@softure-ai/security/signed-request` imports nothing else, so an edge worker signs with the same code.
- Migrate an app that keeps its own verifier: read the body with `readSmallBodyBytes`, replace the local check with
  `verifySignedRequest({ secret, header, body: bytes, now: new Date() })` and its tests with a round trip through
  `signRequestBody`; on the sending worker, sign the raw bytes with `signRequestBody` from
  `@softure-ai/security/signed-request` and drop a base64-in-JSON envelope. The header format is the same
  `t=,v1=` scheme, so a verifier that already signs `"<t>.<body>"` keeps working during the switch.
## 0.2.0

- **Breaking (#446):** the built-in `pl` dictionary is gone; English is the only built-in copy and the fallback for
  every other locale, which is now any BCP 47 tag. Migrate: an app that shows Polish keeps its own translation and
  passes it as the overrides for its locale, `security({ messages: { pl: myTranslation } })`; a key it leaves out
  reads English.

## 0.1.8

- Bucket definitions take an optional `key: "ip" | "account" | "subject"`: what the bucket counts by
  (`RATE_LIMIT_KEY_KINDS`, `RateLimitKeyKind`). Configs without it parse unchanged; an unknown kind is refused.
- `listRateLimitBuckets(config)` in `@softure-ai/security/server`: the configured buckets with name, limit, window
  and `key`, for the privacy policy's list of IP-keyed processing.
- `overrideBuckets(defaults, overrides)`: a copy of a package's bucket defaults with some thresholds changed, keeping
  the rest of each bucket; an unknown name throws. `RateLimitBucketInput` is exported.

## 0.1.7

- New `unidentified` option: `"refuse"` (the default, as before) or `{ key }`, which counts every request no
  resolver identifies under one shared key `unidentified:<key>`, for a stack with no edge in front (`next dev`, a test
  stack). `identifyClient` then returns `Ok<"unidentified:<key>">`.
- README: the same-image setup (a deploy-time variable switches the fallback on the test stack only) and why proxy
  headers behind Cloudflare carry the edge's address, not the client's.

## 0.1.6

- Described in the GitHub Release `security@0.1.6`.
