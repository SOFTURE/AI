# Plan review: billing-price-minor-units

Reviewed: plan.md @ 2026-10-04. Mode: deep (money). Verdict: ready after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.
Grounding: 8/8 paths, 5/5 symbols (`getMinorUnitDigits`, `isSupportedCurrency`, `formatPrice`,
`getDigitShift`, `planSchema`), 4/4 commands (`npm run typecheck|lint|test|build`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: the three unknowns are answered (ISO + MGA override; `Intl` with fixed digits; README note) and the runtime agreement test is item 1.2 |
| Slicing | PASS: one phase; validation, formatting and Stripe must switch to the table together |
| Verifiability | PASS: unit tests pin the digits, so the CI runner's CLDR can no longer change a result |
| Data and migrations | PASS: no migration; stored amounts keep their unit (none recorded in an affected currency, Stripe is not live) |
| Failure paths | WARN (W1) |
| Tests | WARN (W2) |
| Security | PASS: no new input |
| Lean | WARN (S1) |
| Fit | PASS: one module owns the unit; Stripe's conversion keeps its shape |
| Scope | PASS: FU-33 and later untouched |
| Reuse | PASS: `Intl` still does the notation |
| Lessons | PASS (FU-25's CI lesson: never derive an expected amount from the runtime) |
| Progress format | PASS |

## Findings

### W1 [WARNING] A stored row in a code outside the table must not break the admin pages
**Effort:** low. **Lens:** Failure paths. **Where:** `src/next/pages.tsx:152,190,197` · Phase 1, step 3
**Problem:** The admin request list and account history format prices read from the database. If
`formatPrice` threw for a code outside the table, one old row would take the page down.
**Fix:** `getMinorUnitDigits` throws (charging an unknown code is a bug), but `formatPrice` falls back
to `Intl`'s own formatting for a code outside the table; a test for both.
**Decision:** Fix now (applied) - key decisions and step 3 say so; step 1 tests it.

### W2 [WARNING] Tests must stop deriving expected amounts from the runtime
**Effort:** low. **Lens:** Tests. **Where:** `tests/stripe-currency.test.ts:43-46`, `tests/stripe.test.ts:57`
**Problem:** FU-25 made the HUF/TWD expectations follow `getMinorUnitDigits`, so they pass whatever the
digits are and would not catch a regression to the runtime.
**Fix:** Literal expectations (HUF 2950 goes to Stripe as 2950).
**Decision:** Fix now (applied) - step 1 says "HUF/TWD tests stop deriving from the runtime".

### S1 [SUGGESTION] Keep only prices in the table
**Effort:** low. **Lens:** Lean. **Where:** `src/currency-digits.ts`
**Problem:** UYW (a wage index unit, 4 digits) is not a fund in ISO's flags but is no price either;
keeping it would make 4 a legal digit count for one code nobody charges in.
**Fix:** Leave it out with the funds; a test asserts every entry has 0, 2 or 3 digits.
**Decision:** Fix now (applied).

## Summary

Fixed: W1, W2, S1. Accepted: -. Deferred: -. Dismissed: -.
