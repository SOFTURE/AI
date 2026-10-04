---
change_id: billing-price-minor-units
title: "A plan's price means the same amount on every runtime"
status: archived
roadmap_item: FU-32
branch: claude/project-thread-9fohl9
created: 2026-10-04
updated: 2026-10-04
archived_at: 2026-10-04
---

## Intent

The minor unit of a plan's `price.amount` is pinned by billing (ISO 4217, with the one override
billing chooses) instead of read from the runtime's `Intl`, so the same config is validated,
formatted and charged as the same amount on every Node build.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-32).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-32** (roadmap `followups`):

> - **Outcome:** The minor unit of a plan's `price.amount` comes from a table billing pins (ISO 4217, with the overrides billing chooses), not from the runtime's `Intl`/CLDR, so a HUF 29.50 plan is formatted and charged the same on every Node build; a test fails if the pinned table and the runtime disagree in a way that changes a price.
> - **Unknowns:** Which digits to pin for currencies where ISO 4217 and CLDR differ (HUF, TWD, ISK, ALL, IQD ...); whether to keep formatting through `Intl` with `minimumFractionDigits`/`maximumFractionDigits` set from the table; how to tell deployers whose plans were written against the other unit.
> - **Risk:** MEDIUM. `getMinorUnitDigits` reads `Intl`, whose digits vary with the runtime's CLDR: HUF has 2 digits on Node 22.22 locally and 0 on the CI runner's Node 22 (FU-25's first CI run), so `amount: 2950` is HUF 29.50 on one and HUF 2,950 on the other, in the tiles and at Stripe alike.
> - **Baseline:** MO-2 `billing-plans-pricing`: amounts in `Intl`'s minor unit (`src/price.ts`); FU-25 converts to Stripe's unit from those digits, so it inherits the runtime dependence.
> - **Source:** FU-25 `billing-stripe-currency-units` CI; `modules/billing/src/price.ts`

## Constraints

- Owns `modules/billing/src/price.ts` and its users (`src/stripe-currency.ts`, the options check in
  `src/options.ts`), their tests and the billing README (lane C, after FU-30). FU-33 and later lane C
  items are not done here; other gaps go to the followups roadmap as new FU items.
- No new runtime dependency: the table is a constant in the package, its source and date named.
- English only. No release, tag or publish (owner).

## Notes

- Research: kept (money; the open question is which digits to pin, and the answer depends on the
  ISO list, the runtime's CLDR and Stripe's rules side by side).
- Framing skipped: the problem is stated and reproduced (FU-25's CI run, HUF 0 vs 2 digits); the
  open choices (which digits, formatting through `Intl`, telling deployers) are design decisions the
  research and plan make, not doubts about the problem.
- Archived 2026-10-04: billing pins each currency's minor unit (`CURRENCY_MINOR_UNIT_DIGITS`, ISO 4217
  List One 2024-06-25, MGA 0, XCG added); validation, formatting and Stripe's conversion read it, and
  `Intl` only supplies the notation. ALL, RSD, LAK and the other ISO-2/CLDR-0 currencies now go to
  Stripe unchanged; IQD has three decimals; HUF and TWD have two on every runtime.
