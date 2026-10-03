# @softure-ai/analytics

**Status:** wave 3 · channel tags implemented (MO-4); the funnel counter follows in MO-5 · depends on: core

Knows which acquisition channel a visitor came from (`?z=newsletter`) **without a cookie and
without storing anything**: the tag lives only in first-party URLs. A piece for the app's
`proxy.ts` keeps it on the address bar from page to page and through redirects, so a sign-up
posted from a tagged page knows its channel and auth's `onRegistered` hook can attribute the new
account. Built from FIRE_TRACKER's `src/lib/channel-tag.ts` and the channel part of `src/proxy.ts`,
with the parameter, its pattern and its length moved into configuration and the redirects split
out of the auth guard.

## 1. What it provides

- **A configurable tag.** `analytics({ channel: { param, pattern, maxLength } })`: the query
  parameter (default `z`), what a valid value looks like (default lowercase words joined by `-` or
  `_`) and its longest length (default 32, at most 64). An invalid value is ignored, never trimmed,
  cut or repaired.
- **Propagation without a cookie** (`/proxy`, `createChannelTagger(config)`):
  - `tag(request)`: a GET navigation (a browser page load, or a Next.js client navigation) without
    the parameter, coming from a same-origin page with a valid one (`Referer`), is answered with a
    307 to the same URL plus the tag. Fetches, images, beacons and server actions pass untouched.
  - `carry(request, response)`: a same-origin redirect another proxy piece answered with (auth's
    guard sending `/account?z=ads` to login) gets the request's channel added to its `Location`.
- **The channel for the app** (`/next`): `getChannel()` in server actions, route handlers and
  hooks (read from the page the request was sent from), `getChannelFromSearchParams()` in pages.
- **Attribution of sign-ups**: `attributeRegistration(onChannel)` is an `onRegistered` hook for
  auth that calls `onChannel({ userId, channel }, ctx)` inside the account's transaction when the
  sign-up came with a channel. Where the attribution goes (a column, a counter) is the app's choice.
- **Framework-free reading** (`/server`): `parseChannel`, `readChannel(config, { url, referer, host })`,
  `withChannel`, `hasChannelParam`, `isFirstParty`.

## 2. Installation

```bash
npm install @softure-ai/analytics @softure-ai/core zod
```

Peer dependency: `next` 16 (for `/next`; `/proxy` and `/server` use Web `Request` and `Response` only).
The module depends on no other module.

## 3. Configuration

```ts
import { analytics } from "@softure-ai/analytics";

// in defineSoftureConfig({ modules: [...] }); every key is optional:
analytics({ channel: { param: "z", pattern: /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, maxLength: 32 } }),
```

| Option | Default | Rule |
| --- | --- | --- |
| `channel.param` | `"z"` | lowercase letters, digits, `-` or `_`, starting with a letter, at most 32 characters |
| `channel.pattern` | `DEFAULT_CHANNEL_PATTERN` | a `RegExp` without the `g` or `y` flag (they keep state between tests) |
| `channel.maxLength` | `32` | an integer from 1 to `MAX_CHANNEL_LENGTH` (64) |

Attribution in auth, next to another hook (privacy's consent):

```ts
import { attributeRegistration } from "@softure-ai/analytics/next";
import { recordRegistrationConsent } from "@softure-ai/privacy/server";

const recordConsent = recordRegistrationConsent();
const attributeChannel = attributeRegistration(({ userId, channel }, ctx) => saveSignupChannel(ctx.db, userId, channel));

auth({ onRegistered: async (event, ctx) => { await recordConsent(event, ctx); await attributeChannel(event, ctx); } }),
```

`/next` imports `next/headers` only when a function runs, so `softure.config.ts` (which
`softure migrate` loads in plain Node) can import it.

## 4. Mounting

The proxy piece, after the auth guard (the guard decides first; the tag never opens a private page):

```ts
// proxy.ts
import { createChannelTagger } from "@softure-ai/analytics/proxy";
import { createAuthGuard } from "@softure-ai/auth/proxy";
import { NextResponse, type NextRequest } from "next/server";
import softureConfig from "./softure.config";

const guard = createAuthGuard(softureConfig, { protect: ["/account"] });
const channels = createChannelTagger(softureConfig);

export function proxy(request: NextRequest): Response {
  return channels.carry(request, guard(request)) ?? channels.tag(request) ?? NextResponse.next();
}
```

`createChannelTagger` throws at startup when `analytics()` is not in the configuration. Keep the
proxy's `matcher` on pages (static files excluded); API routes the matcher reaches are not
navigations, so `tag` passes them.

## 5. Migrations and tables

None yet: channel tags store nothing. MO-5 adds the schema `analytics` with `funnel_counts`.

## 6. Environment variables

None.

## 7. Switches

None.

## 8. Appearance

No components.

## 9. Copy

None yet: the `en` and `pl` dictionaries in `src/messages/` are empty until the funnel report.

## 10. Hooks

- `attributeRegistration(onChannel)` builds an auth `onRegistered` hook (§3). `onChannel` runs in
  the account's transaction with the hook's context; an error it throws rolls the account back.

## 11. GDPR

The module stores nothing and sets no cookie, so it exports and deletes nothing. A channel the app
saves per account (through `attributeRegistration`) is the app's data: its export and deletion
belong to the app's own privacy contributor.

## 12. Limitations

- **The `Referer` carries the chain.** An app that sends `Referrer-Policy: no-referrer`, `origin`
  or `strict-origin` (or a page with such a `<meta name="referrer">`) breaks it at that page;
  `same-origin` and the browser default keep it.
- **First party only.** A hop through another origin (a payment provider, a mail link) loses the
  tag unless the app puts it on the return URL itself (`withChannel`).
- **Client navigations are recognised by `Next-Url`.** Next.js strips its `RSC` header before the
  proxy runs, so a router request counts as a navigation when it carries the `Next-Url` header the
  router sends; a client navigation without it is not re-tagged, and the next page load or link
  from a tagged URL puts the tag back.
- **Client-side state.** A page that changes its URL without a navigation (`history.replaceState`
  dropping the query) drops the tag for the next request.
- **Last tag wins.** A URL with its own tag replaces the earlier one; there is no first-touch memory
  without storage.
- `getChannel()` reads the page the request came from; a page's own render reads its
  `searchParams` instead.
