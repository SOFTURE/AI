# Implementation review: auth-page-redirect-tag

Scope: full · Date: 2026-10-04 · Commits: 05e4ce8 · Gates: typecheck ✓ lint ✓ test ✓ (2398 tests, 25 skipped) · build ✓ · e2e ✓ (92/92, local Postgres)

## Verdict
Ready. A signed-in visitor who loads `/login?z=spring-promo` is answered `307 Location: /account?z=spring-promo`
(and `/register?next=/account/privacy&z=…` → `/account/privacy?z=…`), because both pages send the visitor on through
`resolveRedirectTarget` with their own search params and analytics' `tagRedirect` reads the channel from them. The two
tagging e2e cases fail with the old `redirect(next)` (checked locally). Auth still does not import analytics; existing
rewrites keep their `{ config }` context for actions. One suggestion accepted.

## Dimensions
| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | - |
| Progress honesty | PASS (every `[x]` re-run in this session) | - |
| Correctness | PASS | - |
| Tests | PASS (unit: context with and without params, unsafe page rewrite, page channel over `Referer`, no channel; e2e with a proven failing run) | - |
| Security | PASS (the page redirect now also passes `toSafeNextPath` on the rewrite's result; only a channel matching the module's pattern enters a URL; `next` is still made safe before the rewrite) | - |
| Patterns and lessons | PASS (FU-7 seam reused; `/next` imports nothing new; L-002) | S1 |
| Migrations | n/a | - |

## Plan coverage
| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1: Page redirects through the rewrite, and the proof | 05e4ce8 | yes | `TagRedirectContext` exported from analytics `/next` (names `tagRedirect`'s parameter, mirrors auth's `RewriteRedirectContext`) |

Files: planned 13, changed 13 plus the change folder. Unplanned: `modules/analytics/src/next/index.ts` (the type
export). Existing test cases: none edited or removed.

## Findings

### S1 [SUGGESTION] `readSearchParams` awaits the props promise a third time
**Impact:** LOW · **Dimension:** Patterns · **Where:** `modules/auth/src/next/pages.tsx:50-56`
**What:** the pages await `searchParams` in `readNext`, `readParam` and now `readSearchParams`. **Why it matters:** an
awaited, settled promise; no extra work, only repetition. **Evidence:** the existing `readParam` already does it per call.
**Fix:** await once per page and pass the record. **Decision:** accept - matches the file's existing helpers; a refactor of
every page is outside this change.

## Progress audit
1.1 and 1.2: `npx vitest run modules/auth modules/analytics` (306 passed). 1.3: e2e 3/3 "a signed-in visitor"; with the
old redirect 2 failed as recorded in plan.md. 1.4: `analytics-channel` 12/12 and `analytics-funnel` in the full run.
1.5: typecheck, lint, test, build and the example's `next build` (inside `npm run e2e`).

## Triage summary
Fixed: -. Accepted: S1. Deferred: -. Dismissed: -.

## Lessons proposed
None new; FU-7's practice (prove an e2e fails without the fix, assert the redirect response itself) held again.

## Decisions (auto)
- S1 → accept (consistent with the file; no behaviour change).
