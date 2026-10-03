# Implementation review: billing-admin-requests

Scope: full · Date: 2026-10-04 · Commits: 0d5b298..63a224c (+ the fix commit of this review) · Gates: typecheck ✓ lint ✓ test ✓ (2272 passed, 25 skipped) build ✓ · e2e: 82 passed (local Postgres 16), billing specs re-run after the fixes

## Verdict

Ready after fixes. Both phases deliver the plan: invoice requests are stored (one open per account
and plan, details cleared on close), the admin page grants or dismisses them, every manual grant is
recorded with what it added, a revoke takes back only that grant (moving later periods of both
tables), an account's history merges manual grants and provider payments, and a lifetime account
can neither pay nor be granted again. One real concurrency finding (F1) was fixed; the rest are
accepted with evidence.

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage and drift | PASS (drift recorded) | F2 |
| Correctness | WARN → PASS after fixes | F1 |
| Tests | PASS | — |
| Migrations | PASS | — |
| Security | PASS | F3 |
| Patterns and lessons | PASS | F4 |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1 Requests, manual grants and revoke on the server | 0d5b298 | yes | migration `0004`, `requests.ts`, `grants.ts`, `take-back.ts` shared with the refund, privacy, lifetime refusal in `startPayment` |
| 2 Admin page, payment page, e2e and docs | 63a224c | yes | three admin cards, lifetime notice, `admin-ui.test.tsx`, three new e2e tests, README, FU-22 filed |

Files: planned and changed 40 · unplanned 2 (`src/server/take-back.ts` split out of
`payments.ts`; `src/server/user-id.ts` gains `isUuid`) · planned, not changed 0.

## Findings

### F1 [WARNING] A refund and a revoke of one account could deadlock
**Where:** `src/server/payments.ts` (`refundPayment`), `src/server/grants.ts` (`revokeManualGrant`), `src/server/take-back.ts`
**Problem:** both flipped their own row first and then waited for the entitlement lock, while the
one holding the entitlement moves later periods back, which updates the other's row: revoke holds
grant X and waits for the entitlement, the refund holds the entitlement and updates X's dates.
Postgres would abort one with a deadlock error (a 500 to Stripe, which retries, or an error under
the admin's button). The same shape existed between two refunds since FU-11.
**Fix:** lock order account → entitlement (`lockEntitlementRow`) → own row in both flows (the grant
already did this); the shift then runs only under the entitlement lock every take-back queues on.
**Decision:** fixed in the review commit; billing unit tests and the billing e2e specs re-run green.

### F2 [SUGGESTION] Plan drift: `routes.admin` instead of `refresh()`
**Where:** `src/index.ts` (manifest), `src/server/options.ts`, `src/next/actions.ts`
**Problem:** the plan chose `refresh()` because the admin page had no route; the account lookup
(plan review W1) needs a path to redirect to anyway, so the module now declares
`routes.admin` (`/admin/billing`, overridable) and the actions use `revalidatePath` like
mcp-access.
**Decision:** accepted; README §3 documents the route, `module.test.ts` covers the default and an
override.

### F3 [SUGGESTION] Admin ids stay out of the account's export
**Where:** `src/server/privacy.ts`
**Problem:** `granted_by`/`revoked_by` are another person's id; exporting them would hand one
account's data to another.
**Decision:** accepted as designed; erasing an admin sets them NULL (FK), tested in `privacy.test.ts`.

### F4 [SUGGESTION] No paging in the admin lists
**Where:** `OPEN_REQUESTS_LIMIT` (50), `ACCOUNT_HISTORY_LIMIT` (100)
**Problem:** a very busy app would not see requests past the first 50.
**Decision:** accepted; README §12 says so. Manual invoices are low-volume by nature.

## Progress audit

Phase 1 ticked with 0d5b298; phase 2 is ticked in the progress commit with 63a224c. No Manual items.

## Triage summary
Fixed: F1. Accepted: F2, F3, F4. Deferred: -. Dismissed: -.

## Lessons proposed
None: F1 is recorded in the code comments and the README's lock order.
