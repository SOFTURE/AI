# Research: analytics-channel-tags

## 1. Where the tag lives without a cookie (unknown 1)

- Only in first-party URLs. A tag on the address bar is the source; the browser's default
  `Referrer-Policy` (`strict-origin-when-cross-origin`) sends the full same-origin URL as `Referer`,
  so the next request knows the page it came from.
- Navigation: a GET document navigation (`Sec-Fetch-Mode: navigate`) or a Next.js client navigation
  (`RSC: 1`, the router follows the redirect and shows the final URL) without the parameter, whose
  same-origin `Referer` carries a valid tag, is answered with a 307 to the same URL plus the tag. The
  tag then sits in the address bar again and the next hop repeats it.
- Server actions are POSTs from the tagged page: their `Referer` is that page, so `getChannel()`
  reads it there (sign-up included). Pages read their own `searchParams`.
- Limits: an app that sends `Referrer-Policy: no-referrer`, `origin` or `strict-origin` cuts the
  chain; a cross-origin hop (a payment provider) loses it. Both go in the README limitations.

## 2. Order with the auth guard (unknown 2)

- The guard answers protected paths without a session cookie with a redirect to login (`?next=`).
  The channel piece does not know about auth: `carry(request, response)` adds the tag to any
  same-origin redirect another piece returned, and `tag(request)` handles the request when no piece
  answered. `proxy.ts`: `channels.carry(request, guard(request)) ?? channels.tag(request) ?? NextResponse.next()`.
- The guard runs first, so a protected page is never reached through a channel redirect.

## 3. Attribution in `onRegistered`

- Auth's hook receives `{ user, consent }` and the module context, not the request. Inside Next the
  hook runs within the register action, so `headers()` is available; `attributeRegistration(handler)`
  reads the tag there and calls the handler only when there is one. `next/headers` is imported
  lazily so `softure.config.ts` (loaded by `softure migrate` in plain Node) can import `/next`.
- The module defines the hook type structurally; it does not depend on auth.

## 4. Validation

- Parameter name: `^[a-z][a-z0-9_-]{0,31}$`, default `z` (FIRE's).
- Value: default pattern `^[a-z0-9]+(?:[-_][a-z0-9]+)*$`, default max length 32 (hard cap 64);
  RegExp flags `g` and `y` refused (`lastIndex` state). An invalid value is ignored, never repaired.
- Origin: the `Referer` and a redirect `Location` count only when their origin is the request's own
  or `appOrigin` (behind a proxy the request URL may carry an internal host).
