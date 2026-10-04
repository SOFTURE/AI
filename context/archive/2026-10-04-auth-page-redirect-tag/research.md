# Research: auth-page-redirect-tag

Input: change.md, roadmap FU-28. Depth: quick (two pages in auth, one helper in analytics, Next's render redirect, no data).
Snapshot: 22ea72d on claude/fu-28-auth-page-redirect-tag-jxa369 (from master), 2026-10-04 03:20 CEST.

## Summary
- A page that calls `redirect()` while it renders answers the request itself: Next sets the redirect error's status
  (`307` for `redirect()` outside an action) and its URL as `Location` (`node_modules/next/dist/server/app-render/app-render.js:2386-2390`,
  Next 16.3.8). The proxy ran before the render and saw no redirect (`carry` only wraps the guard's answer), and the
  browser's follow-up GET carries the `Referer` of the navigation that opened the tagged page (the page before it, or
  none from another site). So, as with actions, only a tagged URL passed to `redirect()` keeps the tag.
- A server component cannot read its own URL from the request: `headers()` has the previous page as `referer` and
  `next-url` only on router requests; the page's own query reaches it only as the `searchParams` prop. So the rewrite
  can tag a page redirect only if the page hands it its search parameters.
- The FU-7 seam fits: `resolveRedirectTarget(config, path)` (`modules/auth/src/redirect-target.ts`) already guards the
  app's `rewriteRedirect` (safe path, logged failure). Its context `{ config }` (`modules/auth/src/options.ts:24`) can
  carry the page's search parameters as well; analytics' `tagRedirect` (`modules/analytics/src/next/channel.ts:41-44`)
  can read the channel from them with `getChannelFromSearchParams` (same file, `:27-32`) instead of `Referer`.

## Current state
- `modules/auth/src/next/pages.tsx:49-52` (`LoginPage`) and `:70-73` (`RegisterPage`): `next = toSafeNextPath(searchParams.next, afterLogin)`,
  then `if (await getCurrentUser() !== null) redirect(next)`, before anything renders.
- `modules/auth/src/redirect-target.ts`: `resolveRedirectTarget(config, path)`; used by every action in `src/next/actions.ts`.
- `RewriteRedirect = (path, ctx: { readonly config }) => Promise<string> | string` (`src/options.ts:24`), exported from
  `src/index.ts:95`; README options table row (`modules/auth/README.md:74`) says "every action's redirect".
- `tagRedirect(path, ctx = { config })` reads `getChannel(ctx.config)` (the `Referer`), then `tagPath` (leaves a path
  with its own tag alone). `SearchParamsInput` (`URLSearchParams` or a page's record) is already exported from `/next`.
- `requireUser({ next })` (`src/next/current-user.ts:30-36`) also redirects during a render (to login) and reads no
  search parameters; the example app guards `/account` in the proxy (`carry` keeps the tag there), so that render
  redirect is only reached on pages the proxy does not guard.

## Affected surface
| Area | Files | Why |
| --- | --- | --- |
| Auth option | `modules/auth/src/options.ts`, `src/redirect-target.ts` | the rewrite context gains the page's search parameters |
| Auth pages | `modules/auth/src/next/pages.tsx` | the signed-in redirect goes through `resolveRedirectTarget` |
| Analytics helper | `modules/analytics/src/next/channel.ts` | `tagRedirect` reads the channel from the page's parameters when given |
| e2e | `examples/next-app/e2e/analytics-channel.spec.ts` | a signed-in visitor's tagged login and register page loads |
| Docs | `modules/auth/README.md` (options table), `modules/analytics/README.md` §3, §10, §12 | the option covers page redirects; the FU-28 limitation goes |

## Data
None.

## Tests
- Unit: `modules/auth/tests/redirect-target.test.ts` (rewrite context, safety); `modules/analytics/tests/next.test.ts`
  (`tagRedirect` with mocked `next/headers`). Pages need Next and are covered by e2e only (as before).
- e2e: register, then `page.goto("/login?z=…")`; the document response is the `307`, readable with
  `page.waitForResponse` or `request.get(..., { maxRedirects: 0 })` with the session cookie.
- Run: `npm test`; e2e `npm run e2e` with local Postgres (`DATABASE_URL`, `PLAYWRIGHT_CHROMIUM_PATH`).

## Patterns to follow
- FU-7's `resolveRedirectTarget`: result through `toSafeNextPath`, failure logged by error name, auth's path kept.
- `/next` imports `next/headers` lazily (keeps `softure.config.ts` loadable in plain Node); reading search parameters
  needs no Next import at all.

## Prior work
- [`archive/2026-10-03-analytics-action-redirect-tag/`](../../archive/2026-10-03-analytics-action-redirect-tag/change.md) (FU-7): the seam this change extends.
- [`archive/2026-10-03-analytics-client-navigation/`](../../archive/2026-10-03-analytics-client-navigation/change.md) (FU-5): `<ChannelKeeper />`.

## SOFTURE modules
`@softure-ai/auth` and `@softure-ai/analytics`; no other module involved.

## Risks
- A breaking change to `RewriteRedirect` (low): adding an optional field to the context is compatible with every
  existing rewrite (`tagRedirect` and apps' own functions ignore it).
- A rewrite that reads `Referer` during a page render would tag with the previous page's channel (low): `tagRedirect`
  must prefer the page's parameters whenever they are given, even when they carry no tag.

## Relevant lessons
- L-002: bare Next imports, typed through `next-modules.d.ts`; `/next` must stay loadable in plain Node.

## Answers to unknowns
- Can `rewriteRedirect` read the page's own URL in a render? Not from the request; only if auth passes the page's
  `searchParams` in the rewrite context. Auth already has them (it reads `next` from them).
- Does the case matter beyond the account page's beacon? See `frame.md`.

## Open questions
- `requireUser`'s render redirect to login has the same blind spot but no search parameters to hand over; out of this
  change's scope (the roadmap item names the login and register pages), recorded as a followups gap.
