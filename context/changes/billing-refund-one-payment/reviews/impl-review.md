# Implementation review: billing-refund-one-payment

Scope: full · Date: 2026-10-03 · Commits: 00c14f9..c75eac4 · Gates: typecheck ✓ lint ✓ test ✓ (2228 passed, 25 skipped before the fix commit; billing 222 passed after) build ✓ · e2e: 78 passed (local Postgres 16)

## Verdict

Ready after fixes. Both phases deliver the plan: payments record their grant (migration `0003`), a
full refund takes back the unused days of one period or ends one lifetime, rows from before keep
the old revoke, and lifetime keeps the dated end beside it. Two findings were fixed in c75eac4 (F1
was a real correctness bug in a three-payment stack); two are accepted with evidence.

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage and drift | PASS | — |
| Correctness | WARN → PASS after fixes | F1, F2 |
| Tests | PASS | — |
| Migrations | PASS | F4 |
| Security | PASS | — |
| Patterns and lessons | PASS | F3 |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1 Grant record and per-payment refund | 00c14f9 | yes | migration, events, `refund.ts`, `applyPlan`, refund flow, privacy export, tests |
| 2 e2e, docs, followups | f934d38 | yes | stacked-month e2e, ledger line, README, FU-19 and FU-20 |

Files: planned and changed 17 · unplanned 0 · planned, not changed 0. Fixes from this review:
c75eac4.

## Findings

### F1 [WARNING] Stored periods after a refunded one went stale
**Impact:** HIGH · **Dimension:** Correctness · **Where:** `modules/billing/src/server/payments.ts` (`refundPayment`)
**What:** a refund moves the dated end back, but the periods stored on the payments stacked after
the refunded one kept their old dates. With three stacked months, refunding the first early and the
second once it was used up took 27 days of the third month, because the second still claimed
17 November to 17 December.
**Why it matters:** a later refund would take access the account paid for.
**Fix:** move the stored periods of later paid payments back by the same unused days
(`shiftLaterPeriods`, `moveBackByDays`); test "moves the periods stacked after a refunded month".
**Decision:** fix now (c75eac4).

### F2 [WARNING] A grant that recorded nothing would refund as a full revoke
**Impact:** MEDIUM · **Dimension:** Correctness · **Where:** `src/server/payments.ts` (`recordPayment`)
**What:** `applyPlan` returns a null grant for an event that added nothing; stored as NULL columns it
reads like a row from before `0003`, whose refund revokes all paid access.
**Why it matters:** cannot happen for a plan grant today (a period is at least a day), but a silent
fallback to the harshest path is the wrong failure mode.
**Fix:** throw (a bug) when a paid plan's grant is missing; NULL stays reserved for old rows.
**Decision:** fix now (c75eac4).

### F3 [SUGGESTION] Raw `grant { until }` events overlap periods
**Impact:** LOW · **Dimension:** Patterns · **Where:** `src/refund.ts`
**What:** an app that calls `changeEntitlement` with its own `grant { until }` inside the stack does
not add a period of its own, so a refund shifts it with the stack.
**Why it matters:** only hand-written app code; plan grants (admin page and webhook) stack.
**Fix:** none; documented in README §12.
**Decision:** accept risk (auto): no caller in the repository does it.

### F4 [SUGGESTION] Old lifetime rows do not count as "another lifetime"
**Impact:** LOW · **Dimension:** Migrations · **Where:** `src/server/payments.ts` (`hasOtherLifetimePayment`)
**What:** a lifetime payment recorded before `0003` has `grant_kind` NULL and is not counted.
**Why it matters:** billing is not released yet (MO-6), so no such rows exist outside tests.
**Fix:** none; README §12 says rows from before `0003` keep the old behaviour.
**Decision:** accept risk (auto).

## Progress audit

Every Progress item is ticked with the phase commit; no Manual items. Matches the commits.

## Triage summary

Fixed: F1, F2. Accepted: F3, F4. Deferred: -. Dismissed: -.

## Lessons proposed

- A stored derived interval (a payment's period) must move whenever the timeline it describes is
  edited, or later operations read stale positions. Candidate for `softure-lesson`.
