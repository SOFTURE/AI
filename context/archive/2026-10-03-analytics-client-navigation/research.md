# Research: analytics-client-navigation

Input: change.md, roadmap FU-5. Depth: quick (one module, client and proxy behaviour, no data).
Snapshot: de2273f on claude/project-thread-y037s0 (from master), 2026-10-04 00:30 CEST.

## Summary
- The proxy has no stable signal for a router request: before `proxy.ts` runs, Next 16.3.8 deletes every flight
  header (`RSC`, `Next-Router-State-Tree`, `Next-Router-Prefetch`, `Next-Router-Segment-Prefetch`, `Next-HMR-Refresh`)
  and the `_rsc` parameter (`node_modules/next/dist/server/web/adapter.js:156-172`,
  `client/components/app-router-headers.js:104-110`). `Next-Url` survives only because it is not on that list, and the
  router sends it only when its `nextUrl` is not null (`router-reducer/fetch-server-response.js:96-98`,
  `segment-cache/cache.js:1198`, `:1514`).
- Some client navigations never reach the proxy: a route the router already prefetched can render from its segment
  cache, and `router.replace`/`history.replaceState` change the URL with no request. No proxy rule can tag those.
- So the fix belongs in the browser. Next's App Router supports `window.history.replaceState(null, "", url)` from app
  code and syncs it into `usePathname`/`useSearchParams` without a server request (`client/components/app-router.js:268-279`).
- A client component mounted once in the root layout can remember the last valid channel it saw in the address bar and,
  after each navigation that lands on a URL without the parameter, put it back with `replaceState`. It runs in a layout
  effect, so page components' `useEffect` (`<FunnelBeacon>`) already see the tagged URL as their `Referer`.
- A link wrapper was the other candidate: it only covers links the app rewrites, not `router.push`, redirects or
  cache-served navigations, and every app link would have to change.
- The proxy's `Next-Url` rule stays: when it fires, the new page renders on the server with its tag
  (`getChannelFromSearchParams`); the client piece is the net under it.

## Current state
- Proxy piece: `createChannelTagger(config).tag` (`modules/analytics/src/proxy/index.ts:58-71`) answers a GET
  navigation without the parameter, from a same-origin page with a valid one, with a 307 to the tagged URL;
  `isNavigation` (`:82-88`) accepts `Sec-Fetch-Mode: navigate`, `RSC: 1`, or `Next-Url` on a non-subresource.
- Channel rules: `parseChannel(value, options)` (`modules/analytics/src/server/channel.ts:19-22`) is pure; options come
  from `getChannelOptions(config)` (`server/options.ts:25-27`): `param`, `pattern` (a RegExp without `g`/`y`,
  `src/options.ts:26-37`), `maxLength`.
- Client code already shipped: `/client` (`createFunnelReporter`, Web APIs only), `/ui` (`FunnelBeaconReporter`, a
  `"use client"` component that `<FunnelBeacon>` in `/next` renders with server-read config, `src/next/funnel.tsx:27-31`).
- Example app: `examples/next-app/app/layout.tsx` (root layout, server component), `proxy.ts` chains guard, `carry`, `tag`.

## Affected surface
| Area | Files | Why |
| --- | --- | --- |
| Pure keeper logic | `modules/analytics/src/client/` | the remembered channel and the URL to restore, testable in node |
| Shared rule | `modules/analytics/src/server/channel.ts` | `parseChannel` must be importable by browser code without `@softure-ai/core` |
| Client component | `modules/analytics/src/ui/` | `useLayoutEffect` + `usePathname`/`useSearchParams` |
| Server wrapper | `modules/analytics/src/next/` | reads the channel options from the config and renders the client part in `<Suspense>` |
| Types for Next | `modules/analytics/src/next/next-modules.d.ts` | bare `next/navigation` (L-002) |
| Example and e2e | `examples/next-app/app/layout.tsx`, `e2e/analytics-channel.spec.ts` | mount it; prove a navigation without `Next-Url` |
| Docs | `modules/analytics/README.md` §1, §4, §12 | mounting line; the limitation goes |

## Data
None.

## Tests
- Unit: `modules/analytics/tests/proxy.test.ts` (Next-Url rule, lines 30-40), `client.test.ts` (beacon), `next.test.ts`.
  Vitest runs in the `node` environment (`vitest.config.mts:28`): no DOM, so the keeper's logic must be a pure function.
- e2e: `examples/next-app/e2e/analytics-channel.spec.ts` (a `next/link` click from `/login?z=spring-promo` and from
  `/account?z=spring-promo`). Playwright's `page.route` can drop `Next-Url` from the router's requests to reproduce the gap.
- Run: `npm test`; e2e `npm run e2e` with local Postgres (`DATABASE_URL`, `PLAYWRIGHT_CHROMIUM_PATH`).

## Patterns to follow
- Server component reads config, passes plain props to a `/ui` client component: `src/next/funnel.tsx:27-31`.
- Browser code never breaks the page and logs only an error name: `src/client/index.ts:38-41`.
- Bare Next specifiers with an ambient declaration: `src/next/next-modules.d.ts` (L-002).

## Prior work
- [`archive/2026-10-03-analytics-channel-tags/`](../../archive/2026-10-03-analytics-channel-tags/change.md) (MO-4): the proxy piece and the Next-Url discovery.
- [`archive/2026-10-03-analytics-funnel/`](../../archive/2026-10-03-analytics-funnel/change.md) (MO-5): beacons read the channel from `Referer`.

## SOFTURE modules
Covered by `@softure-ai/analytics` itself; no other module involved.

## Risks
- A `useSearchParams` in the root layout without `<Suspense>` makes a static build bail out to client rendering
  (likely; mitigation: the `/next` wrapper renders the client part inside `<Suspense fallback={null}>`).
- A loop of replaces (low: after the replace the URL carries the parameter, so the next run does nothing).
- An app that removes the parameter on purpose with `replaceState` gets it back (low; same rule as the proxy: a tag
  is replaced only by another tag). Documented.

## Relevant lessons
- L-001: the package is built with `tsc`, which keeps `"use client"`.
- L-002: import `next/navigation` bare, typed through `next-modules.d.ts`; prove it with the example app's build.

## Answers to unknowns
- Stable proxy signal for router requests? No: every flight header is removed before the proxy and `Next-Url` is
  optional (evidence above). Some navigations send no request at all.
- Client component or link wrapper? A client component in the root layout: it covers links, `router.push`, redirects and
  cache-served navigations with one mount line.

## Open questions
- Keep the proxy's `Next-Url` rule? Decided (agent): yes, it lets the server render see the tag; the client piece
  covers what it misses.
