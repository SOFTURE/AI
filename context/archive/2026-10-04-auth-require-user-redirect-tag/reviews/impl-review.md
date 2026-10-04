# Implementation review: auth-require-user-redirect-tag

Scope: full · Date: 2026-10-04 · Commits: 2ba9a5b · Gates: typecheck ✓ lint ✓ test ✓ (2529 tests, 29 skipped) · build ✓ · e2e ✓ (95/95, local Postgres)

## Verdict
Ready. An anonymous `/payment?plan=monthly&z=spring-promo` is answered `307 Location:
/login?next=%2Fpayment%3Fplan%3Dmonthly&z=spring-promo`, and logging in there lands on
`/payment?plan=monthly&z=spring-promo`, because `requireUser` now sends its redirect through `resolveRedirectTarget`
with the page's search params and billing's payment page passes them. The e2e case fails with the old `redirect(path)`
(checked locally). Auth still does not import analytics; without `rewriteRedirect` the redirect is unchanged. One
suggestion accepted.

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | - |
| Progress honesty | PASS (every `[x]` re-run in this session) | - |
| Correctness | PASS (`next` is made safe and encoded before the rewrite, as before; the tag goes on the login URL, the login action tags `next` from it, FU-7) | - |
| Tests | PASS (unit: no rewrite, page record with repeated values, `URLSearchParams`, action-style context, unsafe and throwing rewrite, signed-in user; e2e with a proven failing run) | - |
| Security | PASS (the rewrite's result passes `toSafeNextPath`; a throwing rewrite is logged by error name and auth's path kept) | - |
| Patterns and lessons | PASS (FU-28 seam reused; the pages' conversion moved, not copied; L-002) | S1 |
| Migrations | n/a | - |

## Plan coverage
| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1: requireUser through the rewrite, and the proof | 2ba9a5b | yes | - |

Files: planned 10, changed 10 plus the change folder. Unplanned: none. Existing test cases: none edited or removed.

## Findings

### S1 [SUGGESTION] Prop-less module pages still call `requireUser` without parameters
**Impact:** LOW · **Dimension:** Patterns · **Where:** `modules/privacy/src/next/pages.tsx:19`, `modules/mcp-access/src/next/pages.tsx:58`, `modules/auth/src/next/pages.tsx:117`
**What:** these pages take no `searchParams`, so a direct tagged visit without a session reaches login untagged.
**Why it matters:** only when an app mounts them outside the guard. **Evidence:** their default routes are
`/account/privacy` and `/account/mcp` (`modules/privacy/src/index.ts:38`, `modules/mcp-access/src/index.ts:35`), under the
documented guard prefix; the guard always protects `routes.changePassword`.
**Fix:** give each page props for parameters it never reads. **Decision:** accept - the plan's out-of-scope list; the
guard's `carry` keeps the tag there.

## Progress audit
1.1: `npx vitest run modules/auth/tests/require-user.test.ts` (6 passed; 4 failed before the change). 1.2: e2e case
passes; with `requireUser`'s old `redirect(path)` on a local build it fails (`Location` without the tag). 1.3:
`analytics-channel`, `analytics-funnel` and the billing specs inside the full run (95/95). 1.4: typecheck, lint,
`npm test` and the builds (`npm run build`, the example's `next build`).
Observed: one unit test failed in a run of auth, billing and analytics while the example's `next build` and the full
e2e ran in parallel; the next two runs (the same set, then `npm test`) were green. Not reproduced; CI decides.

## Triage summary
Fixed: -. Accepted: S1. Deferred: -. Dismissed: -.

## Lessons proposed
None new.
