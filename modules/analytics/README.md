# @softure-ai/analytics

**Status:** wave 3 · channel tags (MO-4) and the funnel counter (MO-5) implemented · depends on: core, db, security (its body reader)

Knows which acquisition channel a visitor came from (`?z=newsletter`) **without a cookie and
without storing anything**: the tag lives only in first-party URLs. A piece for the app's
`proxy.ts` keeps it on the address bar from page to page and through redirects, so a sign-up
posted from a tagged page knows its channel and auth's `onRegistered` hook can attribute the new
account. Built from FIRE_TRACKER's `src/lib/channel-tag.ts` and the channel part of `src/proxy.ts`,
with the parameter, its pattern and its length moved into configuration and the redirects split
out of the auth guard.

It also counts a **funnel without personal data**: how many visits reached each configured step
from each channel on each day, and nothing else (no address, cookie, visit id or account). Built
from FIRE_TRACKER's `src/lib/funnel-{steps,beacon}.ts`, `src/db/funnel-counts.ts`,
`src/app/actions/do-funnel.ts` and `scripts/kanaly-report.sql`, with the steps, the cap and the time
zone moved into configuration and the report turned into a function.

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
- **The funnel** (`analytics({ funnel: { steps } })`): `analytics.funnel_counts` holds one counter
  per (day, channel, step). Each step is counted one way:
  - `pixel`: `<FunnelPixel step="landing" />` (`/next`) renders a 1×1 image; a page view counts
    without JavaScript;
  - `beacon`: `<FunnelBeacon step="pricing" />` (`/next`) or `createFunnelReporter(endpoint)`
    (`/client`) sends `navigator.sendBeacon` with `step=<id>` and nothing else, once per step;
  - `server`: only the app's code counts it, with `recordFunnelStep(ctx, { step, channel })`
    (`/server`) or `countRegistration("signup")` (`/next`, an auth `onRegistered` hook). The public
    endpoint refuses these steps, so nobody outside can inflate them.
- **The endpoint** (`/next`, `createFunnelRoute()`): `POST` takes beacons (body at most 256 bytes),
  `GET` serves the pixel. Both count only requests sent from one of the app's pages (`Referer`,
  `Sec-Fetch-Site`), take the channel from that page, never from the request, and answer the same
  (204, or the GIF) whatever the input; 503 only when the database fails. Every answer is `no-store`.
- **The day** is the calendar day in `timezone` of `softure.config.ts`, whatever the server's zone.
- **A cap on new channels**: at most `channelCap` (default 100) distinct channels a day get their
  own counter; new ones past it count under `OVERFLOW_CHANNEL` (`~overflow`, which no channel
  pattern may accept). A channel counted before, today or on an earlier day, is never capped.
- **The report** (`/server`): `getFunnelReport(ctx, { days })` returns the last `days` days
  (default 30) per channel (`tagged`, `untagged` or `overflow`), each step's count in funnel order,
  the busiest channel first, with totals. `pruneFunnelCounts(ctx, { keepDays })` deletes older days.

## 2. Installation

```bash
npm install @softure-ai/analytics @softure-ai/core @softure-ai/db @softure-ai/security drizzle-orm zod
```

Peer dependencies: `next` 16 and `react` 19 (for `/next` and `/ui`; `/proxy`, `/server` and
`/client` use Web APIs only) and `drizzle-orm`. The module depends on no other module in
`softure.config.ts`; it uses `@softure-ai/security`'s body reader as a library, so it needs no
rate limit bucket.

## 3. Configuration

```ts
import { analytics } from "@softure-ai/analytics";

// in defineSoftureConfig({ modules: [...] }); every key is optional:
analytics({
  channel: { param: "z", pattern: /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, maxLength: 32 },
  funnel: {
    steps: [
      { id: "landing", via: "pixel" },
      { id: "pricing" }, // via: "beacon" by default
      { id: "signup", via: "server" },
    ],
    channelCap: 100,
  },
  routes: { funnel: "/api/analytics/funnel" },
}),
```

| Option | Default | Rule |
| --- | --- | --- |
| `channel.param` | `"z"` | lowercase letters, digits, `-` or `_`, starting with a letter, at most 32 characters |
| `channel.pattern` | `DEFAULT_CHANNEL_PATTERN` | a `RegExp` without the `g` or `y` flag (they keep state between tests) |
| `channel.maxLength` | `32` | an integer from 1 to `MAX_CHANNEL_LENGTH` (64) |
| `funnel.steps` | `[]` | up to 32 steps, ids kebab-case and at most 32 characters, each listed once; `via` is `beacon` (default), `pixel` or `server` |
| `funnel.channelCap` | `100` | an integer from 1 to 10 000 |
| `routes.funnel` | `/api/analytics/funnel` | the endpoint's path; `<FunnelPixel>` and `<FunnelBeacon>` use it |

Counting sign-ups as the last step, next to the other hooks (`countRegistration` runs in a
savepoint and logs a failure instead of throwing, so a broken counter never refuses a sign-up):

```ts
import { countRegistration } from "@softure-ai/analytics/next";

const countSignup = countRegistration("signup");
auth({ onRegistered: async (event, ctx) => { await recordConsent(event, ctx); await countSignup(event, ctx); } }),
```

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

The funnel endpoint, one line (the endpoint must be public: keep it out of the auth guard):

```ts
// app/api/analytics/funnel/route.ts
import { createFunnelRoute } from "@softure-ai/analytics/next";

export const { GET, POST } = createFunnelRoute();
```

Steps on pages, in server components:

```tsx
import { FunnelBeacon, FunnelPixel } from "@softure-ai/analytics/next";

<FunnelPixel step="landing" />   // on the landing page
<FunnelBeacon step="pricing" />  // on the pricing page
```

Both throw on render for a step that is not configured with their kind. A client component that
counts wizard steps itself uses `createFunnelReporter(endpoint)` from `/client`.

A report, for an admin page or a script:

```ts
import { getFunnelReport } from "@softure-ai/analytics/server";
import { getAnalyticsContext } from "@softure-ai/analytics/next";

const report = await getFunnelReport(await getAnalyticsContext(), { days: 30 });
```

## 5. Migrations and tables

Schema `analytics`, migration `0001_create_funnel_counts`: `funnel_counts (day, channel, step,
count)`, primary key `(day, channel, step)`; `channel` is `''` without a tag. The table checks the
step's shape, the channel's length and a positive count. The module's health check
(`checkFunnelTable`) answers once the table exists. Old days stay until the app prunes them
(`pruneFunnelCounts`); they hold no personal data.

## 6. Environment variables

None.

## 7. Switches

None.

## 8. Appearance

Nothing visible: `<FunnelPixel>` is a transparent 1×1 image and `<FunnelBeacon>` renders nothing.

## 9. Copy

None: the pixel and the beacon show nothing, and the report is data the app renders with its own
copy. The `en` and `pl` dictionaries in `src/messages/` are empty.

## 10. Hooks

- `attributeRegistration(onChannel)` builds an auth `onRegistered` hook (§3). `onChannel` runs in
  the account's transaction with the hook's context; an error it throws rolls the account back.
- `countRegistration(step)` builds an auth `onRegistered` hook that counts every sign-up (with its
  channel or without one) as a `server` step; it never throws.

## 11. GDPR

The module sets no cookie and stores no personal data: the funnel keeps only sums per day, channel
and step, which no person can be found in, so it exports and deletes nothing. A channel the app
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
- **A server action's redirect drops the tag.** After sign-up, auth's redirect to `afterLogin`
  opens without `?z=`, so steps after it count without a channel until a tagged page is opened
  (FU-6). The sign-up step itself is attributed.
- **Waitlist sign-ups are not a step yet.** The waitlist has no hook to count them from (FU-7);
  the funnel never reads another module's table.
- **The funnel is a noise filter, not a defence.** Its endpoint checks that a request comes from one
  of the app's pages, but those headers come from the client: a forged `Referer` passes. The counts
  open nothing and the cap bounds the table, so the endpoint has no per-address rate limit on
  purpose: one would store every visitor's address.
- **Counts are visits that reached a step**, each step at most once per page view; a visitor who
  opens the page twice counts twice. There is no unique-visitor number without an identifier.
