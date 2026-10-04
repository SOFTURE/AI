---
change_id: billing-stripe-currency-units
title: "Stripe charges the plan's price in every currency"
status: backlog
roadmap_item: FU-25
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

The Stripe adapter sends each plan's price in the unit Stripe expects for its currency: special-case currencies (ISK and UGX sent ×100; HUF and TWD amounts divisible by 100, per Stripe's currency guide) are scaled or refused when the config loads, and formatting is tested for a 3-decimal currency (KWD).

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-25** (roadmap `followups`):

> ### FU-25: Stripe charges the plan's price in every currency
> - **Change ID:** `billing-stripe-currency-units`
> - **Status:** proposed
> - **Outcome:** The Stripe adapter sends each plan's price in the unit Stripe expects for its currency: special-case currencies (ISK and UGX sent ×100; HUF and TWD amounts divisible by 100, per Stripe's currency guide) are scaled or refused when the config loads, and formatting is tested for a 3-decimal currency (KWD).
> - **Prerequisites:** FU-24 on `master` (lane C).
> - **Unknowns:** The exact list and rules in Stripe's current currency guide (confirm first; the FU-12 session could not fetch it); scale in the adapter vs. refuse the currency.
> - **Risk:** MEDIUM.
> - **Baseline:** monetization MO-2 `billing-plans-pricing` and MO-3 `billing-provider-adapter`: prices are minor units by `Intl` (`src/price.ts`), and `stripe()` sends `unit_amount = plan.price.amount` unchanged (`src/stripe.ts`), so an ISK 1,500 plan would be charged ISK 15. After: the gap is closed and covered by unit tests on the Checkout request.
> - **PRD refs:** FR-22.
> - **Source:** FU-12 retro plan review of MO-2, W1 (`context/archive/2026-10-03-billing-plans-pricing/reviews/plan-review.md`); `modules/billing/src/stripe.ts`, `modules/billing/src/price.ts`

## Constraints

- Owns: `modules/billing/src/stripe.ts` and `src/price.ts` (lane C, after FU-24). No Stripe secrets: unit tests on the request body.
- English only. No release, tag or publish (owner).

## Notes

- Filed by FU-12 (`billing-retro-reviews`, 2026-10-04).
