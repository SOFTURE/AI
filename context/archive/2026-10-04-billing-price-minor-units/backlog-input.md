---
change_id: billing-price-minor-units
title: "A plan's price means the same amount on every runtime"
status: backlog
roadmap_item: FU-32
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

The minor unit of a plan's `price.amount` is pinned by billing instead of read from the runtime's
`Intl`, so the same config formats and charges the same amount on every Node build.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-32** (roadmap `followups`):

> ### FU-32: A plan's price means the same amount on every runtime
> - **Change ID:** `billing-price-minor-units`
> - **Status:** proposed
> - **Outcome:** The minor unit of a plan's `price.amount` comes from a table billing pins (ISO 4217, with the overrides billing chooses), not from the runtime's `Intl`/CLDR, so a HUF 29.50 plan is formatted and charged the same on every Node build; a test fails if the pinned table and the runtime disagree in a way that changes a price.
> - **Prerequisites:** FU-30 on `master` (lane C).
> - **Unknowns:** Which digits to pin for currencies where ISO 4217 and CLDR differ (HUF, TWD, ISK, ALL, IQD ...); whether to keep formatting through `Intl` with `minimumFractionDigits`/`maximumFractionDigits` set from the table; how to tell deployers whose plans were written against the other unit.
> - **Risk:** MEDIUM. `getMinorUnitDigits` reads `Intl`, whose digits vary with the runtime's CLDR: HUF has 2 digits on Node 22.22 locally and 0 on the CI runner's Node 22 (FU-25's first CI run), so `amount: 2950` is HUF 29.50 on one and HUF 2,950 on the other, in the tiles and at Stripe alike.
> - **Baseline:** MO-2 `billing-plans-pricing`: amounts in `Intl`'s minor unit (`src/price.ts`); FU-25 converts to Stripe's unit from those digits, so it inherits the runtime dependence. After: the gap is closed and covered by unit tests that pin the digits.
> - **Source:** FU-25 `billing-stripe-currency-units` CI (unit tests on HUF failed on the runner with 295000 for 2950); `modules/billing/src/price.ts`

## Constraints

- Owns: `modules/billing/src/price.ts` and its users (`src/stripe-currency.ts`, the options check) (lane C, after FU-30).
- English only. No release, tag or publish (owner).

## Notes

- Filed by FU-25 (`billing-stripe-currency-units`, 2026-10-04).
