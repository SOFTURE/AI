# Plan review: billing-refund-one-payment

Reviewed: plan.md @ 2026-10-03. Mode: deep. Verdict: ready after fixes.
Findings: 1 critical, 1 warning, 1 suggestion.
Grounding: 9/9 paths, 7/7 symbols, 2/2 commands

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | FAIL (C1) |
| Slicing | PASS |
| Verifiability | WARN (W1) |
| Data and migrations | PASS |
| Tests | WARN (W1) |
| Security | PASS |
| Lean | PASS |
| Fit | PASS |
| Cost and defaults | WARN (S1) |

## Findings

### C1 [CRITICAL] Shifting by the whole window takes back used time and breaks after a lapse
**Effort:** medium. **Lens:** Coverage and end state. **Where:** Approach, "Reversal"; Phase 1, step 4 (plan.md) · `src/plans.ts:59-63`
**Problem:** Periods stack only while access is running: `getPlanGrant` starts at
`max(now, trialEndsAt, paidUntil)`, so after paid access lapses a new payment starts at `now` and
leaves a gap. Shifting `paid_until` back by the full length of a refunded window then takes a
January refund out of a June period the account paid for, and for stacked months refunded late it
charges the used month against the next one.
**Fix A (Recommended):** take back only the unused part of the window, `[max(from, now), until)`;
nothing when the window already ended. The future part of the timeline is always contiguous
(every grant starts where running access ends), so shifting the end back is exact there.
Strength: right after a lapse and for late refunds; consumed access is the merchant's goodwill.
Trade-off: a refund of a used-up period takes nothing back. Confidence: high, the contiguity holds
by construction in `getPlanGrant`. Blind spot: raw `grant { until }` events from app code overlap
windows; documented.
**Fix B:** store segments and recompute. Strength: exact for any history. Trade-off: a new table and
manual grants stay invisible. Confidence: medium. Blind spot: trial extensions.
**Decision:** Fix now (applied, Fix A) - Goal, Key decisions (new "Shift amount" row), Phase 1
step 4 (`getRefundEvent` takes `now`) and tests (future, running, used-up window, lapse) updated;
research open question corrected.

### W1 [WARNING] Existing tests pin the behaviour this change reverses
**Effort:** low. **Lens:** Tests. **Where:** Phase 1, Tests · `tests/entitlements.test.ts:172-174`, `tests/entitlement.test.ts:90-96`
**Problem:** the CHECK test for `entitlements_lifetime_without_end` and the pure tests "leaves
lifetime access as it is on a dated grant" / "dropping its end" assert the old semantics; the plan
did not name them, so Done-when could be met by deleting them.
**Fix:** name them in Tests as updated cases with the new expected values.
**Decision:** Fix now (applied) - listed under Phase 1 Tests.

### S1 [SUGGESTION] Partial refunds and manual lifetime grants need a home
**Effort:** low. **Lens:** Cost and defaults. **Where:** Goal, Out of scope
**Problem:** both are left out; without an FU entry they become silent limitations.
**Fix:** file FU-20 and FU-21 in Phase 2 (already step 4) and name them in README §12.
**Decision:** Fix now (applied) - Phase 2 step 3 and 4 already carry it; kept.

## Triage summary
Fixed: C1, W1, S1. Accepted: -. Deferred: -. Dismissed: -. Verdict after triage: ready.

## Decisions (auto)
- C1 → Fix A (exact for contiguous future access, no new table).
- W1, S1 → Fix now (cheap).
