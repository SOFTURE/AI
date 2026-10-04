# Implementation review: analytics-action-redirect-tag

Scope: full · Date: 2026-10-04 · Commits: a4e38ad..a82a351 · Gates: typecheck ✓ lint ✓ test ✓ (2346 tests, 25 skipped) · build ✓ · e2e ✓ (89/89, local Postgres)

## Verdict
Ready. Auth's login, sign-up, password-reset and logout actions redirect through the app's `rewriteRedirect`, and the
example passes analytics' `tagRedirect`, so the action itself answers the tagged URL: `x-action-redirect:
/account?z=spring-promo` with JavaScript and `303 Location: /account?z=spring-promo` without it. Both e2e cases fail
with the option removed (checked locally). Auth does not import analytics. One finding fixed during implementation
(F1), one accepted (F2).

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | drift recorded in plan.md `## Decisions (auto)` |
| Progress honesty | PASS | - |
| Correctness | PASS | F1 (fixed) |
| Tests | PASS | - |
| Security | PASS (the rewrite's result goes through `toSafeNextPath`, so it cannot leave the app; the channel is validated by the module's pattern before it enters a URL; a throwing rewrite is logged by error name only) | - |
| Patterns and lessons | PASS (function option like `onRegistered`; lazy `next/headers` keeps `/next` loadable in plain Node, the "never reaches next/navigation" test still passes; L-002) | F2 |
| Migrations | n/a | - |

## Plan coverage
| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1: The option, the helper and the proof | a82a351 | yes | helper in `src/redirect-target.ts` (drift, recorded) |

Files: planned 19, changed 21. Unplanned: `context/backlog/roadmap-followups/auth-page-redirect-tag/change.md` and
`context/backlog/roadmap-followups/README.md` (the FU-23 gap the plan named), `modules/auth/src/redirect-target.ts`
instead of `src/server/redirect-target.ts` (drift). Existing test cases: none edited or removed; the e2e helper
`registerFromLogin` was split into `fillRegisterForm` + submit without changing what it asserts.

## Findings

### F1 [WARNING] The no-JavaScript e2e passed without the change
**Impact:** LOW · **Dimension:** Tests · **Where:** `examples/next-app/e2e/analytics-channel.spec.ts` ("without JavaScript")
**What:** the first draft asserted only the final URL. Without `rewriteRedirect` the browser follows the action's
`303 /account` with the register page as `Referer`, and the proxy's `tag` answers a `307` to `/account?z=…`, so the
URL ends tagged either way.
**Why it matters:** the test did not prove the outcome (the action answers the tagged URL, one hop less, and the
target's render needs no proxy round trip).
**Fix:** assert the action's own `303 Location` exactly.
**Decision:** fix now: done before the commit (a82a351); re-checked failing without the option.

### F2 [SUGGESTION] The rewrite runs for every action redirect, including logout
**Impact:** LOW · **Dimension:** Patterns · **Where:** `modules/auth/src/next/actions.ts` (`logoutAction`)
**What:** after logout the login page keeps the visit's channel too.
**Why it matters:** none for attribution (the tag is the visit's, not the account's); it is what the browser keeper
already did since FU-5.
**Fix:** none needed; the README option row names every redirect it applies to.
**Decision:** accept.

## Progress audit
1.1–1.2: `npx vitest run modules/analytics/tests/channel.test.ts modules/analytics/tests/next.test.ts
modules/auth/tests/redirect-target.test.ts` green; red before the implementation (6 failures, missing exports).
1.3–1.5: `npx playwright test` 89/89 on a fresh `next build`. 1.6: gates above and the example's `next build`.

## Triage summary
F1 fixed now, F2 accepted. Nothing deferred to the owner.

## Lessons proposed
- An e2e that proves a server-side redirect must assert the response that redirects, not the final URL, when the proxy
  can reach the same URL on a later hop. (Not recorded as a lesson: one occurrence.)

## Decisions (auto)
- F1 fix now; F2 accept.
