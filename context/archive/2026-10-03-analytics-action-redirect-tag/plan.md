# Plan: analytics-action-redirect-tag

Input: change.md, research.md. Complexity: small.

## Goal
When auth's login, sign-up, password-reset or logout action runs from a page whose URL carries a valid channel tag,
the action redirects to its target with the tag added (`/account?z=ads`), unless the target already carries the
parameter. The target's server render, its beacon and a browser without JavaScript all see the channel. Auth gets a
generic `rewriteRedirect` option and does not depend on analytics; analytics offers `tagRedirect` for it (and for the
app's own actions): `auth({ rewriteRedirect: tagRedirect })`.

**Out of scope:** the page-level redirect of a signed-in visitor away from `/login` or `/register` (a render, not an
action; recorded as a new followups gap); other modules' actions (the app can call `tagRedirect` itself); the proxy
and `<ChannelKeeper />` (unchanged).

## Approach
**Starting point:** Next renders an action's redirect target from the URL passed to `redirect()` (an internal RSC
fetch, or a `303` without JavaScript); the proxy never sees a navigation it could tag (research §Summary).

**Chosen:** the action tags the URL itself. Auth reads an optional `rewriteRedirect(path, { config })` and applies it
to every action redirect through a helper in `src/server/redirect-target.ts`: the result must pass `toSafeNextPath`
(else auth's own path is used), and a thrown error is logged by name and ignored. Analytics adds a pure
`tagPath(config, path, channel)` in `/server` and `tagRedirect(path, ctx?)` in `/next`, which reads the request's
channel with `getChannel()` (the `Referer` of the page the action was posted from) and returns the tagged path.
Rejected: auth importing analytics (a two-way dependency); an analytics wrapper around auth's actions (needs auth's
exports, and cannot change a `redirect()` thrown inside); catching Next's redirect error in an app wrapper (internal shape).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Seam | auth option `rewriteRedirect` | auth stays independent, like `onRegistered` | research §Answers |
| Which redirects | login, register, reset done, logout | the channel survives the whole auth flow | research §Open questions |
| Safety | rewrite result through `toSafeNextPath(result, path)` | a hook must not open a redirect to another origin | research §Risks |
| Failure policy | log `errorLogLabel(error)`, keep auth's path | a broken counter must not block login | `countRegistration` pattern |
| Hook signature | `(path: string, ctx: { readonly config: SoftureConfig }) => string \| Promise<string>` | `tagRedirect` needs only the config; no database work at redirect time | plan |
| Existing tag on the target | left as is | the URL's own parameter decides (`readChannel` rule) | `server/channel.ts` |
| Paths only | `tagPath` touches only paths starting with one `/`; anything else is returned unchanged | redirects are app paths; never parse another origin | plan |

**Critical details:** `tagPath` builds the URL on `config.appOrigin` and returns `pathname + search + hash`, so
`/account?x=1#top` becomes `/account?x=1&z=ads#top`. `tagRedirect` imports `next/headers` lazily (through
`getChannel`), so `softure.config.ts` can import it in plain Node. The auth helper reads `getAuthOptions(config)`.

## Phase 1: The option, the helper and the proof
**Discipline:** TDD. **Files:** `modules/auth/src/options.ts`, `src/index.ts`, `src/server/redirect-target.ts`,
`src/next/actions.ts`, `tests/redirect-target.test.ts`, `modules/auth/README.md`,
`modules/analytics/src/server/channel.ts`, `src/server/index.ts`, `src/next/channel.ts`, `src/next/index.ts`,
`tests/channel.test.ts`, `tests/next.test.ts`, `modules/analytics/README.md`, `examples/next-app/softure.config.ts`,
`examples/next-app/e2e/analytics-channel.spec.ts`, `examples/next-app/e2e/analytics-funnel.spec.ts`,
`context/backlog/roadmap-followups/` (new gap), `context/foundation/roadmap.md`

1. `analytics/tests/channel.test.ts` (red first): `tagPath` adds the channel keeping path, query and hash; leaves a
   path that already has the parameter (any value); returns `//elsewhere.example/x`, `https://…` and `account`
   unchanged; uses the configured parameter.
2. `analytics/src/server/channel.ts`: `tagPath`; export from `/server`.
3. `analytics/tests/next.test.ts`: `tagRedirect` tags the path with the `Referer`'s channel; returns it unchanged
   without a channel or from another origin; takes `{ config }`.
4. `analytics/src/next/channel.ts`: `tagRedirect`; export from `/next`.
5. `auth/tests/redirect-target.test.ts` (red first): `resolveRedirectTarget` returns the path without the option;
   the rewritten path with it (sync and async); auth's path when the result is another origin, `//x`, or not a
   string; auth's path and one logged line (error name only) when the rewrite throws.
6. `auth/src/options.ts`: `RewriteRedirect` type and `rewriteRedirect` option; export the type from `src/index.ts`.
   `auth/src/server/redirect-target.ts`: `resolveRedirectTarget(config, path)`.
7. `auth/src/next/actions.ts`: the four redirects go through `resolveRedirectTarget`.
8. `examples/next-app/softure.config.ts`: `rewriteRedirect: tagRedirect`.
9. e2e `analytics-channel.spec.ts`: "the sign-up action answers with the tagged account page": on
   `/register?z=spring-promo`, the action response's `x-action-redirect` starts with `/account?z=spring-promo`;
   "without JavaScript, sign-up lands on the tagged account page": `javaScriptEnabled: false`, `/login?z=spring-promo`
   → register link → submit → URL `/account?z=spring-promo` and the account shows the signup channel.
10. e2e `analytics-funnel.spec.ts`: the comment about `<ChannelKeeper />` restoring the tag after the redirect is
    rewritten to the new truth (the action answers the tagged URL); the expectation stays.
11. READMEs: auth options table gets `rewriteRedirect`; analytics §4 the wiring line, §1/§5 `tagRedirect`/`tagPath`,
    §12 the FU-7 bullet goes (the page-level redirect gap named instead).
12. New followups gap (FU-24): the page-level redirect of a signed-in visitor from a tagged `/login` drops the tag.

**Tests:** steps 1, 3, 5 unit cases; existing analytics and auth tests unchanged; the two new e2e cases plus the
existing channel and funnel specs.

**Done when:**
- Automated: `tagPath` and `tagRedirect` unit cases pass.
- Automated: `resolveRedirectTarget` unit cases pass, including the unsafe and throwing rewrites.
- Automated: e2e "the sign-up action answers with the tagged account page" passes.
- Automated: e2e "without JavaScript, sign-up lands on the tagged account page" passes.
- Automated: the existing channel and funnel e2e specs pass.
- Automated: Gates green (typecheck, lint, test, build) and the example app's `next build`.

## Risks and rollback
- The no-JavaScript form may not submit through React's progressive enhancement → the e2e shows it; then the test
  posts with JavaScript and reads the `303` path from a raw form request instead.
- An app that already passes `next` with its own tag keeps it (the rewrite leaves a tagged path alone).
- Rollback: revert the phase commit; without the option auth behaves exactly as before.

## Decisions (auto)
- Complexity → small (one phase).
- Implementation drift (small): `resolveRedirectTarget` lives in `modules/auth/src/redirect-target.ts` (next to
  `safe-next-path.ts`), not in `src/server/`: the `/server` entry promises functions that take the module context and
  never read request scope, while the rewrite it calls reads `next/headers`. It is internal; the test imports it by path.
- Implementation drift (small): the first draft of 1.4 checked only the final URL and passed without the option (the
  browser's `GET /account` after the `303` carries the register page as `Referer`, so the proxy's `tag` re-tagged it).
  1.4 now asserts the action's own `303 Location`. Plan review W1 check: with `rewriteRedirect` removed from the
  example's config, 1.3 and 1.4 both fail (`/account` received), checked on a local build.
- New gap FU-24 `auth-page-redirect-tag` (the login and register pages' redirect of a signed-in visitor).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: The option, the helper and the proof

#### Automated
- [x] 1.1 `tagPath` and `tagRedirect` unit cases pass — a82a351
- [x] 1.2 `resolveRedirectTarget` unit cases pass, including the unsafe and throwing rewrites — a82a351
- [x] 1.3 e2e "the sign-up action answers with the tagged account page" passes — a82a351
- [x] 1.4 e2e "without JavaScript, sign-up lands on the tagged account page" passes — a82a351
- [x] 1.5 the existing channel and funnel e2e specs pass — a82a351
- [x] 1.6 Gates green (typecheck, lint, test, build) and the example app's `next build` — a82a351
