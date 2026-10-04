# Plan: auth-page-redirect-tag

Input: change.md, research.md, frame.md. Complexity: small.

## Goal
A signed-in visitor who loads `/login?z=ads` or `/register?z=ads` (or the same with `next`) is answered with a
redirect to `afterLogin` (or `next`) that carries the page's own channel tag (`307 Location: /account?z=ads`), unless
the target already has the parameter. The target's server render and its beacon see the channel, with or without
JavaScript. Auth still does not depend on analytics: the page redirect goes through the same `rewriteRedirect` option
as the actions, and the rewrite context gains the page's search parameters, which analytics' `tagRedirect` prefers
over `Referer`.

**Out of scope:** `requireUser`'s render redirect to login (no search parameters to hand over; recorded as a new
followups gap); action redirects (unchanged, FU-7); the proxy and `<ChannelKeeper />` (unchanged).

## Approach
**Starting point:** `LoginPage` and `RegisterPage` call `redirect(next)` directly for a signed-in visitor
(`modules/auth/src/next/pages.tsx:52,73`); Next answers that render with `307 Location: <next>`; a page render cannot
read its own URL except through `searchParams` (research §Summary).

**Chosen:** the pages call `resolveRedirectTarget(config, next, searchParams)` with their own search parameters as a
`URLSearchParams`; the rewrite context becomes `{ config, searchParams? }` (present only for a page's redirect);
`tagRedirect` reads the channel from `ctx.searchParams` when present (`getChannelFromSearchParams`), from `Referer`
otherwise.
Rejected: a second auth option for page redirects (two options for one concept; the app would wire the same helper
twice); a separate page helper in analytics (more API, same code); falling back to `Referer` in a page render (it is the
page before the tagged one, so it could tag with a stale channel).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Seam | extend `RewriteRedirect`'s context with optional `searchParams: URLSearchParams` | compatible with every existing rewrite; one option for every auth redirect | research §Risks |
| Parameter shape | `URLSearchParams` built from the page's record (every value of a repeated key) | a standard type apps' own rewrites can read; analytics already accepts it | plan |
| Page with parameters but no tag | no channel (no `Referer` fallback) | the page's own URL decides for a page (analytics README §12, `getChannel` vs. `getChannelFromSearchParams`) | frame |
| Exported type | `RewriteRedirectContext` exported from auth's root | apps writing their own rewrite can name it | plan |

**Critical details:** `resolveRedirectTarget` passes `{ config }` alone when no parameters are given, so action
redirects call rewrites exactly as before. The pages build the `URLSearchParams` only when a user is signed in.

## Phase 1: Page redirects through the rewrite, and the proof
**Discipline:** TDD. **Files:** `modules/auth/src/options.ts`, `src/index.ts`, `src/redirect-target.ts`,
`src/next/pages.tsx`, `tests/redirect-target.test.ts`, `modules/auth/README.md`, `modules/analytics/src/next/channel.ts`,
`tests/next.test.ts`, `modules/analytics/README.md`, `examples/next-app/e2e/analytics-channel.spec.ts`,
`context/backlog/roadmap-followups/` (new gap), `context/foundation/roadmap.md`

1. `auth/tests/redirect-target.test.ts` (red first): the rewrite receives `{ config, searchParams }` when parameters are
   given and `{ config }` without them; the safety cases hold for a page redirect too.
2. `auth/src/options.ts`: `RewriteRedirectContext { readonly config; readonly searchParams?: URLSearchParams }`,
   `RewriteRedirect = (path, ctx: RewriteRedirectContext) => …`; export the context type from `src/index.ts`.
   `auth/src/redirect-target.ts`: `resolveRedirectTarget(config, path, searchParams?: URLSearchParams)`.
3. `auth/src/next/pages.tsx`: a `toUrlSearchParams(record)` helper; both pages
   `redirect(await resolveRedirectTarget(config, next, toUrlSearchParams(await searchParams)))`.
4. `analytics/tests/next.test.ts` (red first): `tagRedirect(path, { config, searchParams })` tags with the page's
   channel even when `Referer` carries another one; returns the path unchanged when the parameters carry no valid tag
   (even with a tagged `Referer`); accepts a page's record as well as `URLSearchParams`.
5. `analytics/src/next/channel.ts`: `tagRedirect(path, ctx?: { config; searchParams?: SearchParamsInput })`.
6. e2e `analytics-channel.spec.ts`, describe "a signed-in visitor": after sign-up, `goto("/login?z=spring-promo")`
   ends at `/account?z=spring-promo` and the redirect response (`redirectedFrom()`) has
   `Location: /account?z=spring-promo`; `goto("/register?z=spring-promo&next=/account/privacy")` → `/account/privacy?z=spring-promo`;
   `goto("/login?next=" + encodeURIComponent("/account?z=mail") + "&z=spring-promo")` → `/account?z=mail`. Proof
   that the cases can fail: with the pages' old `redirect(next)` restored on a local build, the first two fail
   (recorded under Decisions).
7. READMEs: auth options table (`rewriteRedirect` covers the login and register pages' redirect, context with
   `searchParams`); analytics §3 (`tagRedirect` and pages), §10, §12 (the FU-28 bullet goes; the `requireUser` gap named).
8. New followups gap (next free FU number on fresh master): `requireUser`'s render redirect to login drops the tag.

**Tests:** steps 1 and 4 unit cases; existing auth and analytics unit tests unchanged; the new e2e cases plus the
existing channel and funnel specs.

**Done when:**
- Automated: `resolveRedirectTarget` unit cases pass, with and without page parameters.
- Automated: `tagRedirect` page-parameter unit cases pass.
- Automated: e2e "a signed-in visitor" cases pass (tagged `Location` on the page's own redirect, `next`, an own tag), and fail with the old page redirect.
- Automated: the existing channel and funnel e2e specs pass.
- Automated: Gates green (typecheck, lint, test, build) and the example app's `next build`.

## Risks and rollback
- The e2e passes without the fix (another piece re-tags the follow-up) → check once with the pages' old `redirect(next)`
  restored locally: the cases must fail.
- An app's own rewrite that ignored the context keeps working; one that reads `Referer` in a page render tags with the
  page before (documented in the auth README row).
- Rollback: revert the phase commit; auth's pages redirect untagged as before.

## Decisions (auto)
- Complexity → small (one phase).
- Plan review S1: no separate no-JavaScript e2e case (the page's redirect is a document `307` answered before any
  script runs, so JavaScript cannot change it; the `Location` assertion covers both).
- 1.3 failing run (plan review W1): with the pages' old `redirect(next)` restored on a local build, "the login page
  sends them on with its own tag" and "the register page sends them to next with its own tag" fail (`/account` and
  `/account/privacy` received); "a next path with its own tag keeps it" passes either way (it guards the own-tag rule).
- New gap FU-31 `auth-require-user-redirect-tag` (`requireUser`'s render redirect to login).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Page redirects through the rewrite, and the proof

#### Automated
- [x] 1.1 `resolveRedirectTarget` unit cases pass, with and without page parameters — 05e4ce8
- [x] 1.2 `tagRedirect` page-parameter unit cases pass — 05e4ce8
- [x] 1.3 e2e "a signed-in visitor" cases pass (tagged `Location` on the page's own redirect, `next`, an own tag), and fail with the old page redirect — 05e4ce8
- [x] 1.4 the existing channel and funnel e2e specs pass — 05e4ce8
- [x] 1.5 Gates green (typecheck, lint, test, build) and the example app's `next build` — 05e4ce8
