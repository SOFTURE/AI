# Research: analytics-action-redirect-tag

Input: change.md, roadmap FU-7. Depth: quick (two modules' redirect paths, Next's action handler, no data).
Snapshot: ac760b0 on claude/project-thread-ooknrg (from master), 2026-10-04 01:55 CEST.

## Summary
- Next renders an action's redirect from the URL passed to `redirect()`, never from a proxy-visible navigation:
  a fetch action (JavaScript on) answers `200` with `x-action-redirect: <url>;<type>` and, for an app-relative URL,
  streams the target's RSC payload, which it fetches itself from `<origin><pathname><search>` of that URL
  (`node_modules/next/dist/server/app-render/action-handler.js:260-330`, Next 16.3.8). A form post without JavaScript
  (an MPA action) answers `303` with `Location: <url>` (`:903-906`). So the only way the target's server render and the
  no-JavaScript client see the tag is that the action passes a tagged URL to `redirect()`.
- The action knows the channel: it is posted from the tagged page, so `getChannel()` (`/next`) reads it from the
  same-origin `Referer` (already used by `attributeRegistration` and `countRegistration` in the same request).
- Auth must not import analytics (the modules depend one way; analytics already avoids auth by typing the part of
  `RegisteredEvent` it reads, `src/next/channel.ts:39-42`). The existing seam is a function option in
  `auth({ ... })`, as `onRegistered` is: the app passes analytics' function in `softure.config.ts`.
- A wrapper of auth's actions inside analytics is not possible without importing auth, and an app-side wrapper
  cannot change the URL a `redirect()` inside the wrapped action throws (it would have to catch Next's redirect error,
  an internal shape).

## Current state
- `modules/auth/src/next/actions.ts`: `loginAction` (`:89`) and `registerAction` (`:114`) call
  `redirect(toSafeNextPath(input.next, getAuthRoutes(config).afterLogin))`; `resetPasswordAction` (`:187`) redirects to
  `login?reset=1`; `logoutAction` (`:213`) to `afterLogout`. The file is `"use server"`: every export is an action, so a
  helper must live elsewhere (`src/server/`).
- `modules/auth/src/options.ts:17,83`: `OnRegisteredHook` and `onRegistered: z.custom<...>(isFunction).optional()`;
  options are read through `getAuthOptions(config)` (`src/server/options.ts:16`).
- `modules/auth/src/safe-next-path.ts`: `toSafeNextPath(candidate, fallback)` keeps only same-origin paths.
- `modules/analytics/src/next/channel.ts`: `getChannel(config)` (lazy `next/headers`, safe for `softure.config.ts` in
  plain Node); `src/server/channel.ts`: `hasChannelParam`, `withChannel(config, url, channel)` on a `URL`.
- `<ChannelKeeper />` (FU-5) tags the target in the browser after it renders; README §12 keeps the FU-7 bullet for
  the server render and clients without JavaScript.
- Example: `examples/next-app/softure.config.ts` wires `auth({ onRegistered })` with analytics' hooks;
  `e2e/analytics-funnel.spec.ts` expects `{ landing: 1, signup: 1, account: 1 }` after a tagged sign-up.

## Affected surface
| Area | Files | Why |
| --- | --- | --- |
| Auth option | `modules/auth/src/options.ts`, `src/index.ts` | a function that may rewrite the redirect path |
| Auth redirect | `modules/auth/src/server/` (new helper), `src/next/actions.ts` | apply it safely in every action redirect |
| Analytics helper | `modules/analytics/src/server/channel.ts`, `src/next/channel.ts`, `src/next/index.ts` | tag a same-origin path with the request's channel |
| Example | `examples/next-app/softure.config.ts` | pass the helper to auth |
| e2e | `examples/next-app/e2e/analytics-channel.spec.ts`, `analytics-funnel.spec.ts` | prove the action answers a tagged target, with and without JavaScript |
| Docs | `modules/analytics/README.md` §4, §12; `modules/auth/README.md` options table | the wiring line; the FU-7 limitation goes |

## Data
None.

## Tests
- Unit: `modules/analytics/tests/next.test.ts` mocks `next/headers` (`:12-13`), so a `/next` helper reading
  `getChannel()` is testable; `tests/channel.test.ts` covers `withChannel`. Auth has no action tests (they need Next);
  a helper in `src/server/` is testable with a config from `tests/support.ts`.
- e2e: Playwright can disable JavaScript per test (`test.use({ javaScriptEnabled: false })`); the action's
  `x-action-redirect` header is readable with `page.waitForResponse`.
- Run: `npm test`; e2e `npm run e2e` with local Postgres (`DATABASE_URL`, `PLAYWRIGHT_CHROMIUM_PATH`).

## Patterns to follow
- A function option validated with `z.custom<T>((value) => typeof value === "function", "must be a function")`
  (`modules/auth/src/options.ts:83`).
- A hook failure that must not break the user's flow is logged by error name, never thrown
  (`countRegistration`, `modules/analytics/src/next/channel.ts:64-76`).
- `/next` imports `next/headers` lazily inside the function (`src/next/channel.ts:20-21`), checked by the
  "never reaches next/navigation" test.

## Prior work
- [`archive/2026-10-03-analytics-client-navigation/`](../../archive/2026-10-03-analytics-client-navigation/change.md) (FU-5): the browser keeper.
- [`archive/2026-10-03-analytics-channel-tags/`](../../archive/2026-10-03-analytics-channel-tags/change.md) (MO-4): `carry` for the auth guard's redirect.

## SOFTURE modules
`@softure-ai/analytics` and `@softure-ai/auth`; no other module involved.

## Risks
- A rewrite that returns another origin's URL would turn auth's redirect into an open redirect (medium; mitigation:
  auth runs the result through `toSafeNextPath`, falling back to its own path).
- A throwing rewrite would block login (low; mitigation: auth logs and keeps its own path).
- `Referer` missing (privacy settings) → no tag; same limitation as today (README §12, first bullet).

## Relevant lessons
- L-002: bare Next imports, typed through `next-modules.d.ts`; `/next` must stay loadable in plain Node.

## Answers to unknowns
- Can analytics wrap auth's actions without auth depending on it? Not as a wrapper; yes through a function option on
  auth (`rewriteRedirect`) that the app fills with analytics' helper, as it does with `onRegistered`.
- How does Next render the redirect target? From the URL given to `redirect()`: an internal RSC fetch of its path and
  query for fetch actions, a `303 Location` for form posts (evidence above). The proxy cannot change either.

## Open questions
- Which redirects get the rewrite? Decided (agent): every action redirect in auth (login, register, reset done, logout),
  so the channel survives the whole auth flow; the page-level redirect of a signed-in user away from `/login`
  (`src/next/pages.tsx:51,73`) renders a GET whose own `searchParams` carry the tag, not a `Referer`; left as a gap.
