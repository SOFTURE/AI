# Plan review: billing-partial-refunds

Reviewed: plan.md @ 2026-10-04. Mode: deep. Verdict: ready after fixes.
Findings: 0 critical, 3 warning, 2 suggestion.
Grounding: 16/16 paths, 12/12 symbols (`readRefund`, `parseStripeEvent`, `receiveStripeWebhook`, `refundPayment`, `takeBackGrant`, `getTakeBackEvent`, `shiftLaterPeriods`, `getRefundEvent`, `getUnusedDays`, `moveBackByDays`, `lockEntitlementRow`, `getAccountHistory`), 4/4 commands (`workflow.json` gates, `npm run build`, `npm run e2e`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS |
| Slicing | PASS |
| Verifiability | PASS |
| Data and migrations | WARN (W3) |
| Tests | WARN (W1) |
| Security | PASS |
| Lean | PASS |
| Fit | WARN (W2) |
| Cost and defaults | PASS (S2) |
| Scope | PASS |
| Reuse | PASS |
| Lessons | PASS |
| Progress format | PASS |

Verified claims (deep): the share rule makes a series of refunds equal one full refund at the time
of the last one. With unused days `U` at the first refund of share `f`, `fU` days go and the
payment's period shrinks by them; at the last refund, `t` days later, `U − fU − t` days are unused
and its share is exactly 1, so the total is `U − t`, what one full refund at that moment takes.
Floor rounding only moves days between steps, never the total. Every caller of `getRefundEvent` is
`take-back.ts:101` and `tests/refund.test.ts`; `takeBackGrant` is called from `payments.ts:136` and
`grants.ts:129`. The route answers 200 for every outcome but `refused` (`src/next/route.ts:53`), so
a new outcome needs no route change. The e2e refund deliveries carry no `amount_refunded`
(`billing-stripe.spec.ts:117,144`), which the plan keeps valid. Migration `0005` is free on master;
FU-27's entry names `0005` as "likely" for its own price snapshot and will take the next number.

## Findings

### W1 [WARNING] The days a take-back returns can disagree with what moved
**Effort:** low. **Lens:** Tests. **Where:** Phase 1, step 5 · `src/server/take-back.ts:115-125`
**Problem:** `takeBackGrant` skips the shift and the event when `getRefundEvent` returns null (no
dated end left, e.g. after an old row's revoke). If it returned the computed days anyway, the
caller would shrink the payment's stored period although access did not move, and the next refund
would compute from wrong dates.
**Fix:** return the days actually applied (0 when no event), and test a partial refund with no
dated end.
**Decision:** Fix now (applied): step 5 and the PGlite case list.

### W2 [WARNING] `keep_access` and the lifetime check order are unspecified
**Effort:** low. **Lens:** Fit. **Where:** Phase 1, steps 5-6
**Problem:** under `keep_access` the plan skips the take-back but the outcome still needs the
account's entitlement; and for a partial lifetime refund `getTakeBackEvent` would ask
`hasOtherLifetime` (a query) before learning the share takes nothing.
**Fix:** the partial-share decision comes before `hasOtherLifetime`; `keep_access` resolves the
current entitlement in the transaction.
**Decision:** Fix now (applied).

### W3 [WARNING] The CHECK must not run before the backfill
**Effort:** low. **Lens:** Data and migrations. **Where:** Phase 1, step 1
**Problem:** adding `payments_refunded_amount_by_status` before setting `refunded_amount = amount`
on refunded rows would fail on any database with a refunded payment.
**Fix:** column, backfill, then the CHECK; state it in the step.
**Decision:** Fix now (applied).

### S1 [SUGGESTION] Integer share math
**Effort:** low. **Lens:** Verifiability. **Where:** Phase 1, step 6
**Problem:** a float share could round 0.9999 × U down a day on the last refund.
**Fix:** the last refund takes all unused days by the `refunded >= outstanding` branch, never by
multiplication; partial shares use `floor(unused × refunded / outstanding)` in integers (bounded by
10^8 × 36,600, safe). Applied.

### S2 [SUGGESTION] The default changes behaviour for an existing app
**Effort:** low. **Lens:** Cost and defaults. **Where:** Goal
**Problem:** with `pro_rata` the default, an app that relied on partial refunds changing nothing
now takes days back.
**Fix:** none needed: billing is unreleased (MO-6 is the owner's batch on 2026-10-05), and the
roadmap asks for a documented default. The README states it and names `keep_access`. Accepted.

## Summary

All three warnings fixed in plan.md; S1 applied; S2 accepted (unreleased module, documented
default). Next: `softure-implement billing-partial-refunds`.
