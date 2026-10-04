# Plan review: billing-stripe-currency-units

Reviewed: plan.md @ 2026-10-04. Mode: deep (money). Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 2 suggestion.
Grounding: 9/9 paths, 6/6 symbols (`getCheckoutSessionParams`, `readCheckout`, `readRefund`,
`isPaymentProvider`, `billingOptionsSchema`, `getMinorUnitDigits`), 4/4 commands
(`npm run typecheck|lint|test|build`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: the retro finding W1 is answered as confirmed by research (HUF/TWD are payout rules; 15 currencies differ, not 2) |
| Slicing | PASS: one phase; the conversion and its inverse must land together |
| Verifiability | PASS: unit tests on the Checkout body and on signed webhook fixtures |
| Data and migrations | PASS: no migration; no stored payment changes |
| Tests | WARN (W2) |
| Security | PASS: no new input; the webhook reads one more field of a signed payload |
| Lean | WARN (S1) |
| Fit | PASS: money stays in `Intl`'s unit inside billing; conversion only at the Stripe boundary |
| Cost and defaults | PASS |
| Scope | PASS: minimum/maximum charges and unsupported currencies stay with Stripe's refusal |
| Reuse | PASS: `getMinorUnitDigits` gives the `Intl` side |
| Lessons | PASS (none applies) |
| Progress format | PASS |

## Findings

### W1 [WARNING] `isPaymentProvider` must reject a non-function `checkPrice`
**Effort:** low. **Lens:** Coverage and end state. **Where:** Phase 1, step 4 · `src/payment.ts:56-65`
**Problem:** The options schema calls `payment.checkPrice` for every plan; a provider object with
`checkPrice: "yes"` would pass the guard and throw a `TypeError` while the config loads.
**Fix:** The guard accepts `checkPrice` only when it is `undefined` or a function; a test.
**Decision:** Fix now (applied) - step 4 says so; the tests name it.

### W2 [WARNING] A partial refund of an affected currency must reach the payment in billing's unit end to end
**Effort:** low. **Lens:** Tests. **Where:** Phase 1, step 5
**Problem:** Converting in `readRefund` is only half the proof: `refundPayment` compares the total
with `payment.amount`. An ISK test that stops at the parsed event would miss a stored amount in the
other unit.
**Fix:** A test through the webhook handler on PGlite: an ISK checkout (`amount_total: 150000`) is
stored as 1500, a partial refund (`amount_refunded: 50000`) stores `refunded_amount` 500, and a full
refund marks it refunded.
**Decision:** Fix now (applied) - item 1.3 covers it through the handler.

### S1 [SUGGESTION] Keep `describeStripePriceProblem` and `toStripeAmount` one rule
**Effort:** low. **Lens:** Lean. **Where:** Phase 1, step 1
**Problem:** Two functions deciding "chargeable" can drift.
**Fix:** `describeStripePriceProblem` returns null exactly when `toStripeAmount` is not null; a test
over every `Intl` currency asserts it.
**Decision:** Fix now (applied).

### S2 [SUGGESTION] Name Stripe's assumption in the code
**Effort:** low. **Lens:** Fit. **Where:** `src/stripe-currency.ts`
**Problem:** A1/A2 are not visible in the current guide's text export.
**Fix:** The constant's comment names the guide and the date read.
**Decision:** Fix now (applied).

## Summary

Fixed: W1, W2, S1, S2. Accepted: -. Deferred: -. Dismissed: -.
Verdict after triage: ready.

## Decisions (auto)
- Scale (option A) rather than refuse ISK/UGX: the deployer's config stays in one unit.
- From-Stripe rounding down: a refund total is never over-counted.
