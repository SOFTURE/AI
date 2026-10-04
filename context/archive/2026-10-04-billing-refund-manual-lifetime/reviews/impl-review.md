# Implementation review: billing-refund-manual-lifetime

Reviewed: the branch diff (`src/server/payments.ts`, `tests/grants.test.ts`, `README.md`) against
plan.md. Verdict: **approved**, no open findings.

## Plan conformance

| Step | Result |
| --- | --- |
| 1. `refundPayment` counts active manual lifetime grants | Done: `hasOtherLifetime` asks `hasActiveManualLifetime(tx, userId)` then `hasPaidLifetimePayment(tx, userId, payment.id)`, the order `revokeManualGrant` uses; the doc comment names both. |
| 2. Tests | Done: "keeps lifetime access while the manual lifetime grant is active" failed without step 1 (the refund left the trial) and passes with it; "ends lifetime access once the manual lifetime grant was revoked" covers the revoke-then-refund case. Plan review F1: the test asserts the payment stored `grant_kind = 'lifetime'`. |
| 3. README | §6 names active manual lifetime grants; the §12 FU-21 limitation is gone, its last sentence kept as its own line. |
| 4. Gates | `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green. |

## Checks

| Check | Result |
| --- | --- |
| Correctness | The read runs in the refund's transaction after the account and entitlement locks; manual grant writers take the entitlement lock first, so the decision sees committed state only. |
| Partial refunds | Unchanged: `getTakeBackEvent` returns before `hasOtherLifetime` for a partial share of a lifetime. |
| Existing behaviour | The grants test "ends a manual lifetime, unless a paid lifetime or another manual one still gives it" (both manual grants revoked, then the refund leaves the trial) stays green. |
| Errors | No new failure path; database errors propagate as before. |
| Language | English only; `npm run lint:language` green. |

## Findings

None. No new gaps for the followups roadmap.
