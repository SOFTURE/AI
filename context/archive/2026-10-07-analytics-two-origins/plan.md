# Plan: analytics-two-origins

Input: change.md (research folded into its Context, framing skipped, see its Notes). Complexity: medium.

## Goal

An app on two first-party origins behind a proxy counts its funnel on both, never moves a visitor to another host,
keeps the channel tag when a link crosses from one origin to the other, tags navigations from untagged article
pages, places the pixel without layout side effects and keeps channels it already knows out of the overflow key.

**Out of scope:** origins outside the app (payment providers, mail links); `X-Forwarded-Host` (the proxy in front
keeps `Host`); a channel derived by the browser keeper from a page path.

## Approach

**Chosen:** one list of first-party origins, `appOrigin` plus `analytics({ origins })`, used by every check
(`isFirstParty`) and by a new `readPublicOrigin(config, request)` that maps the request's `Host` onto that list.
The browser gets the list through `ChannelRule.origins` and tags links to the other origins on click.

Rejected: trusting `Host` + `X-Forwarded-Proto` as an origin outright (a forged `Host` would become a redirect
target); setting a looser `Referrer-Policy` from the package (it is the app's header, and it leaks paths to third
parties too); reading the channel for cross-origin links from a cookie (the module promises no cookie).

**Key decisions:**
| Decision | Choice | Why |
| --- | --- | --- |
| Option | `analytics({ origins: string[] })`, default `[]`, each an http(s) URL reduced to its origin; anything with a path, query, hash or credentials refused | issue's proposal; a typo with a path would silently match nothing |
| First party | `appOrigin`, each of `origins`, the request URL's origin (local dev), or the `Host` without a request URL | old cases kept, new list added |
| Public origin | the configured origin whose host equals `Host` (or the request URL's host without one), the one whose scheme matches the first `X-Forwarded-Proto` value when two share the host; null when none | `Host` only selects; a TLS-terminating hop that reports `http` still finds the `https` origin |
| `tag` target | public origin, else `appOrigin` | point 2 without an open redirect |
| `carry` | a relative `Location` is tagged and stays relative; an absolute one is checked against first party as before | fixes the internal-host base; keeps the browser on its origin |
| Endpoint | `readVisit` compares the `Referer` with the first-party list; the request's public origin is used as its own origin | point 1 |
| Cross-origin links | `ChannelRule.origins` (configured list); the keeper's `tagLink(href, current)` adds the remembered tag to a link whose origin is another configured origin and that has no parameter; `ChannelKeeperClient` rewrites the anchor's `href` on `click`/`auxclick` in the capture phase | the default referrer policy drops the query cross-origin |
| Tagger hook | `createChannelTagger(config, { channelFromReferer })`, used by `tag` and `carry` when the first-party `Referer` has no parameter at all; result passes the rule; a throw is logged and tags nothing | opt-in, the funnel's option is not reused silently so no app changes behaviour |
| Pixel | `className` prop; `decoding="async"`; without `className`, `style={{ position: "absolute" }}` | no line box by default, the app's class wins |
| Known channel | `funnel.isKnownChannel(channel, ctx) => boolean \| Promise<boolean>`; when true the channel is inserted under its own name; a throw propagates like a database failure (the endpoint and hooks already log it and count nothing) | the hook usually reads the database in the same transaction; swallowing a failed statement would leave the transaction aborted anyway |
| Version | analytics 0.1.8 (package.json, module.json, manifest), CHANGELOG, README | auto-release reads package.json |

## Phase 1: first-party origins and the public origin (points 1-3 server side, 4)

**Discipline:** TDD. **Files:** `modules/analytics/src/options.ts`, `src/server/channel.ts`, `src/server/endpoint.ts`,
`src/proxy/index.ts`, `src/server/index.ts`, `src/proxy/index.ts` exports; tests `tests/origins.test.ts`.

- Options: `origins` with normalisation and refusals.
- `getFirstPartyOrigins(config)`, `readPublicOrigin(config, request)`; `isFirstParty` checks the list.
- Endpoint: a beacon or pixel from a page on the second origin counts when `request.url` is internal; one from an
  unconfigured origin still does not.
- Tagger: `tag` on the public origin; a forged `Host` falls back to `appOrigin`; `carry` with a relative
  `Location`; cross-origin `Referer` with a query is read; `channelFromReferer` option.

Done when: new tests fail on 0.1.7 and pass; existing tests unchanged.

## Phase 2: browser keeper, pixel and known channels (points 3 client side, 5, 6)

**Discipline:** TDD. **Files:** `src/client/channel-keeper.ts`, `src/next/channel-keeper-client.tsx`,
`src/server/options.ts` (`getChannelRule`), `src/next/funnel.tsx`, `src/server/funnel.ts`, `src/options.ts`;
tests in `tests/client.test.ts`, `tests/next.test.ts`, `tests/funnel.test.ts`.

Done when: `tagLink` covers same origin, other configured origin, unconfigured origin, already tagged and nothing
remembered; the pixel renders the class or the default style and `decoding`; a channel the hook marks as known is
counted under its name past the cap, a hook throw rejects the count.

## Phase 3: docs and version

**Files:** `modules/analytics/README.md`, `CHANGELOG.md`, `package.json`, `module.json`, `src/index.ts`.

Done when: README documents `origins`, the public origin, the tagger option, the keeper's link tagging, the pixel
props and `isKnownChannel`; gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: first-party origins and the public origin

#### Automated
- [x] 1.1 New tests fail before the implementation and pass after — 37bef84
- [x] 1.2 Gates green (typecheck, lint, test) — 37bef84

### Phase 2: browser keeper, pixel and known channels

#### Automated
- [x] 2.1 New tests fail before the implementation and pass after — a844f77
- [x] 2.2 Gates green (typecheck, lint, test) — a844f77

### Phase 3: docs and version

#### Automated
- [x] 3.1 Gates green (typecheck, lint, test, build) — 31ee2f4
