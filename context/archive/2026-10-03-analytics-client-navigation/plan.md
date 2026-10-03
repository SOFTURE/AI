# Plan: analytics-client-navigation

Input: change.md, research.md. Complexity: small.

## Goal
After every Next.js client navigation from a page whose address bar carries a valid channel tag, the new page's
address bar carries it too, whether the router sent `Next-Url`, sent no request at all (cache, `router.replace`) or
dropped the query with `history.replaceState`. One line in the app's root layout (`<ChannelKeeper />` from
`@softure-ai/analytics/next`) turns it on. No cookie, no storage: the tag lives in the URL only.

**Out of scope:** the server side of server action redirects (FU-7: the redirect target's own render); the proxy's rules (unchanged); first-touch memory; a link wrapper.

## Approach
**Starting point:** the proxy cannot see every router request: Next deletes the flight headers before it runs and
`Next-Url` is optional; cache-served navigations send nothing (research §Summary, §Answers).

**Chosen:** a browser piece. A pure `createChannelKeeper(rule)` in `/client` remembers the last valid channel seen in
the address bar and, for a URL without the parameter, returns the URL with it. `ChannelKeeperClient` (`/ui`, `"use
client"`) runs it in a `useLayoutEffect` keyed on `usePathname()` and `useSearchParams()` and applies the result with
`window.history.replaceState(null, "", url)`, which Next syncs into its router without a request. `<ChannelKeeper />`
(`/next`, server component) reads the channel options from the config and renders the client part in
`<Suspense fallback={null}>`.
Rejected: a `<ChannelLink>` wrapper (covers only rewritten links, not `router.push`, redirects or cache hits; every
link in the app changes); `router.replace` (a second RSC request and a history churn); a cookie or `sessionStorage`
memory (the module's no-storage rule, README §11).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where the fix lives | browser, root layout | the proxy has no signal and misses cache hits | research |
| Proxy `Next-Url` rule | kept | when it fires the server render sees the tag; the keeper is the net | research §Open questions |
| What the keeper remembers | the last value of the parameter in the address bar: valid → remembered, invalid → forgotten | the URL's own parameter decides, as in `readChannel` | `server/channel.ts:25-32` |
| Pattern to the browser | `{ param, pattern: source, flags, maxLength }` plain props | a RegExp is not a serialisable prop | plan |
| `parseChannel` | moved to `src/channel-rule.ts` (no runtime imports), re-exported from `/server` unchanged | browser code must not pull `@softure-ai/core` | plan |
| Effect kind | `useLayoutEffect` | runs before page `useEffect`s, so `<FunnelBeacon>` already sends the tagged `Referer` | research §Summary |
| Replace call | `history.replaceState(null, "", href)` | Next's supported way; `null` state makes Next copy its own and sync the URL | `app-router.js:268-279` |
| Suspense | inside `<ChannelKeeper />` | `useSearchParams` in a layout needs it for static rendering | research §Risks |

**Critical details:** the keeper never touches a URL that already has the parameter (even an invalid value: the user's
own tag decides), so its replace cannot loop. `createChannelKeeper` builds the RegExp once; the schema already refuses
`g`/`y` flags. A malformed href returns null. The client component catches nothing it does not need to: `replaceState`
on a same-origin URL does not throw.

## Phase 1: The keeper, the component and the docs
**Discipline:** TDD. **Files:** `modules/analytics/src/channel-rule.ts`, `src/server/channel.ts`,
`src/client/channel-keeper.ts`, `src/client/index.ts`, `src/ui/channel-keeper.tsx`, `src/ui/index.ts`,
`src/next/channel-keeper.tsx`, `src/next/index.ts`, `src/next/next-modules.d.ts`, `tests/client.test.ts`,
`tests/next.test.ts`, `modules/analytics/README.md`, `examples/next-app/app/layout.tsx`,
`examples/next-app/e2e/analytics-channel.spec.ts`, `examples/next-app/e2e/analytics-funnel.spec.ts`

1. `tests/client.test.ts`: `createChannelKeeper` cases first (red): a tagged URL is remembered and left alone (null);
   then an untagged URL gets the tag (exact href, path, other parameters and hash kept); an untagged first URL stays
   (null); a different valid tag replaces the remembered one; an invalid value is left alone and forgets the channel;
   a value longer than `maxLength` counts as invalid; a custom `param` and `pattern` with flags (`i`) work; a malformed
   href returns null.
2. `src/channel-rule.ts`: `parseChannel` moved here; `server/channel.ts` re-exports it (existing tests unchanged).
3. `src/client/channel-keeper.ts`: `ChannelRule` and `createChannelKeeper(rule)`; export from `src/client/index.ts`.
4. `src/next/channel-keeper.tsx`: `getChannelRule(config)` (exported, pure) and `<ChannelKeeper />`.
   `tests/next.test.ts`: `getChannelRule` returns the default and a custom rule exactly; `<ChannelKeeper />` returns
   a `Suspense` element whose child is `ChannelKeeperClient` with that rule; it throws without `analytics()`.
5. `src/ui/channel-keeper.tsx`: `ChannelKeeperClient`; export from `src/ui/index.ts`. `next/navigation` typed in
   `next-modules.d.ts` (L-002).
6. `examples/next-app/app/layout.tsx`: `<ChannelKeeper />` inside `<body>`.
7. e2e `analytics-channel.spec.ts`: "a client navigation without Next-Url keeps the tag and reaches sign-up": a
   `page.route` drops `next-url` from every request, `/login?z=spring-promo` → register link → URL is
   `/register?z=spring-promo` → sign-up → the account shows the channel. And "the tag comes back after the page drops
   it with replaceState": on `/register?z=spring-promo`, `history.replaceState(null, "", "/register")` → URL returns to
   `/register?z=spring-promo`.
8. e2e `analytics-funnel.spec.ts`: the register action's redirect to `/account` is a client navigation, so the
   keeper now tags it before the account beacon fires. The comment and the extra tagged `goto` that worked around
   FU-7 go; the test expects `{ landing: 1, signup: 1, account: 1 }` right after sign-up.
9. README: §1 lists `<ChannelKeeper />`, §4 the mounting line in the root layout, §12 the `Next-Url` and client-state
   limitations replaced by what remains (a page's own server render reads no tag when the router served it untagged);
   the FU-7 bullet narrows to the server render of an action's redirect target.

**Tests:** client keeper cases; next wrapper cases; existing proxy, channel and next tests unchanged; e2e both new
cases plus the existing channel and funnel specs.

**Done when:**
- Automated: `createChannelKeeper` passes every case of step 1.
- Automated: `getChannelRule` and `<ChannelKeeper />` tests pass; existing analytics tests pass unchanged.
- Automated: e2e "a client navigation without Next-Url keeps the tag and reaches sign-up" passes.
- Automated: e2e "the tag comes back after the page drops it with replaceState" passes.
- Automated: e2e funnel "a tagged visit is counted on the home page, at sign-up and on the account page" counts the
  account view after sign-up under the channel.
- Automated: Gates green (typecheck, lint, test, build) and the example app's `next build`.

## Risks and rollback
- The layout effect runs before Next writes the new URL → the e2e catches it (the keeper would read the old URL and
  do nothing). Mitigation if seen: read `pathname`/`search` from the hooks instead of `window.location`.
- An app strips the tag on purpose and gets it back → documented in README §12.
- Overlap with FU-7: an action's redirect is a client navigation, so the keeper tags its target in the browser. FU-7
  keeps the server render of that target (and clients without JavaScript); the coordinator gets this note.
- Rollback: revert the phase commit; the proxy behaviour is untouched.

## Decisions (auto)
- Complexity → small (one module, one phase).
- Component over link wrapper (research).
- Implementation drift (small): the client component lives in `src/next/channel-keeper-client.tsx`, not `src/ui/`
  (ESLint's NFR-3 rule keeps `ui/` free of `next/*` imports). `<ChannelKeeper />` has its own entry point
  `@softure-ai/analytics/next/channel-keeper`, and `getChannelRule` moved to `/server`: the first e2e run showed
  `softure migrate` failing because `softure.config.ts` imports `/next` in plain Node, which cannot resolve the bare
  `next/navigation`. A test in `tests/next.test.ts` now walks the source graph of `/next` and fails if it reaches
  `next/navigation`. `next.test.ts` imports `ChannelKeeper` from the new entry point.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: The keeper, the component and the docs

#### Automated
- [x] 1.1 `createChannelKeeper` passes every case of step 1 — bcde444
- [x] 1.2 `getChannelRule` and `<ChannelKeeper />` tests pass; existing analytics tests pass unchanged — bcde444
- [x] 1.3 e2e "a client navigation without Next-Url keeps the tag and reaches sign-up" passes — bcde444
- [x] 1.4 e2e "the tag comes back after the page drops it with replaceState" passes — bcde444
- [x] 1.5 e2e funnel counts the account view after sign-up under the channel — bcde444
- [x] 1.6 Gates green (typecheck, lint, test, build) and the example app's `next build` — bcde444
