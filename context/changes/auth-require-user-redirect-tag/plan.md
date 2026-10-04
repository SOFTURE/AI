# Plan: auth-require-user-redirect-tag

Input: change.md, research.md, frame.md. Complexity: small.

## Goal
A visitor without a session who loads a tagged page that calls `requireUser({ next, searchParams })` while it renders
(billing's `/payment?plan=monthly&z=ads`) is answered with `307 Location: /login?next=…&z=ads`; after login they land on
`/payment?plan=monthly&z=ads`. `requireUser`'s redirect goes through the app's `rewriteRedirect` like every other auth
redirect, given the page's search params when the page passes them. Auth still does not depend on analytics.

**Out of scope:** the proxy guard and `carry` (unchanged); `requireRole` (answers "not found", no redirect); module
pages that take no props (auth's change password, privacy's and mcp-access's account pages): they would need new
props for parameters they never read, and they sit under the guard's prefixes in the documented setup.

## Approach
**Starting point:** `requireUser` calls `redirect(login[?next=…])` directly (`modules/auth/src/next/current-user.ts:35`).

**Chosen:** `RequireUserOptions` gains `searchParams?: PageSearchParams` (`URLSearchParams` or a page's awaited record);
`requireUser` builds the same login path and redirects to `await resolveRedirectTarget(config, path, params)`, where
`params` is the converted page parameters when given and absent otherwise. The conversion moves from `pages.tsx` to
`src/next/search-params.ts` (`toUrlSearchParams`), used by both. `PaymentPage` passes `await searchParams`.
Rejected: rewriting only when `searchParams` is given (actions calling `requireUser`, such as billing's
`startPaymentAction`, would stay untagged although their `Referer` is right); accepting the unawaited `Promise` (a page
already awaits it for its own reads; one shape fewer); a README rule alone (frame).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Without `searchParams` | still through the rewrite, context `{ config }` | an action's `Referer` is its page (FU-7); a render's matches what the proxy tags; the option's doc says "every auth redirect" | research §Summary |
| Option shape | `URLSearchParams` or a page's awaited record (repeated values kept) | the page's own prop after `await`; standard type | plan |
| `PaymentPage` | passes its parameters | the guard-free module page in this repo | research |
| Export | `PageSearchParams` type from `@softure-ai/auth/next` | apps can name the option's type | plan |

**Critical details:** the login path (`next` encoding) is built exactly as before; the rewrite's result still passes
`toSafeNextPath` and a failing rewrite falls back to it (`resolveRedirectTarget`). Without `rewriteRedirect` the redirect
is byte for byte what it was.

## Phase 1: requireUser through the rewrite, and the proof
**Discipline:** TDD. **Files:** `modules/auth/src/next/current-user.ts`, `src/next/search-params.ts`, `src/next/pages.tsx`,
`src/next/index.ts`, `tests/require-user.test.ts`, `modules/auth/README.md`, `modules/billing/src/next/pages.tsx`,
`modules/analytics/README.md`, `examples/next-app/e2e/analytics-channel.spec.ts`, `context/foundation/roadmap.md`

1. `auth/tests/require-user.test.ts` (red first, `role-checks.test.ts` mocks, plus `next/navigation`'s `redirect` mocked
   to throw with its URL, so the test does not read Next's internal digest format): anonymous `requireUser()` redirects to
   `/login` and `requireUser({ next })` to `/login?next=…` without a rewrite; with a rewrite the target is the rewrite's
   result, which receives `{ config, searchParams }` for a page record (repeated values kept) or `URLSearchParams`, and
   `{ config }` alone without them; a rewrite that leaves the app or throws keeps auth's login path; a signed-in user
   is returned and the rewrite is not called.
2. `auth/src/next/search-params.ts`: `PageSearchParams`, `toUrlSearchParams`; `pages.tsx` uses it.
3. `auth/src/next/current-user.ts`: the option and the redirect through `resolveRedirectTarget`; export the type from
   `src/next/index.ts`.
4. `billing/src/next/pages.tsx`: `requireUser({ next, searchParams: await searchParams })`.
5. e2e `analytics-channel.spec.ts`, describe "a signed-out visitor on a page that requires a session": register, clear
   cookies, `goto("/payment?plan=monthly&z=spring-promo")`: the redirect (`redirectedFrom()`) is `307` with
   `Location: /login?next=%2Fpayment%3Fplan%3Dmonthly&z=spring-promo`; logging in there lands on
   `/payment?plan=monthly&z=spring-promo`. Proof that it can fail: with `requireUser`'s old `redirect(...)` restored on
   a local build, the case fails (recorded under Decisions).
6. READMEs: auth usage (`requireUser({ next, searchParams })` in pages) and the `rewriteRedirect` row (covers
   `requireUser`); analytics §1, §3 and §12 (the FU-31 bullet goes; pages without parameters noted). Both READMEs keep
   recommending the proxy's guard for private prefixes; the option covers the pages outside it.

**Tests:** step 1 unit cases; existing auth, billing and analytics tests unchanged; the new e2e case plus the existing
channel, funnel and billing specs.

**Done when:**
- Automated: `requireUser` unit cases pass (with and without a rewrite and page parameters, the safety cases).
- Automated: the e2e payment-page case passes and fails with `requireUser`'s old redirect.
- Automated: the existing channel, funnel and billing e2e specs pass.
- Automated: Gates green (typecheck, lint, test, build) and the example app's `next build`.

## Risks and rollback
- An app's own rewrite now also runs for `requireUser`'s redirect; one that returns something odd is caught by
  `toSafeNextPath` (auth's path kept). Documented in the auth README row.
- A page that passes no parameters and whose URL has a different tag than the page before gets the older tag
  (documented in analytics §12; pages that receive `searchParams` should pass them).
- Rollback: revert the phase commit; `requireUser` redirects untagged as before.

## Decisions (auto)
- Complexity → small (one phase).
- Plan review W1: `redirect` mocked in the unit test (Next's digest format is internal).
- Plan review S1: the READMEs keep the guard as the first line for private prefixes.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: requireUser through the rewrite, and the proof

#### Automated
- [ ] 1.1 `requireUser` unit cases pass (with and without a rewrite and page parameters, the safety cases)
- [ ] 1.2 the e2e payment-page case passes and fails with `requireUser`'s old redirect
- [ ] 1.3 the existing channel, funnel and billing e2e specs pass
- [ ] 1.4 Gates green (typecheck, lint, test, build) and the example app's `next build`
