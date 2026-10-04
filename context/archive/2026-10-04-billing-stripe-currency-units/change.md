---
change_id: billing-stripe-currency-units
title: "Stripe charges the plan's price in every currency"
status: archived
roadmap_item: FU-25
branch: claude/fu-25-stripe-currency-units-hokmce
created: 2026-10-04
updated: 2026-10-04
archived_at: 2026-10-04
---

## Intent

The Stripe adapter charges each plan's configured price in every currency: amounts go to Stripe in
Stripe's unit for that currency (not `Intl`'s), amounts Stripe reports back (paid checkouts, partial
refunds) are recorded in billing's unit again, and a price Stripe cannot charge is refused when the
config loads. Formatting is tested for a 3-decimal currency (KWD).

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-25).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-25** (roadmap `followups`):

> - **Outcome:** The Stripe adapter sends each plan's price in the unit Stripe expects for its currency: special-case currencies (ISK and UGX sent ×100; HUF and TWD amounts divisible by 100, per Stripe's currency guide) are scaled or refused when the config loads, and formatting is tested for a 3-decimal currency (KWD).
> - **Unknowns:** The exact list and rules in Stripe's current currency guide (confirm first; the FU-12 session could not fetch it); scale in the adapter vs. refuse the currency.
> - **Baseline:** prices are minor units by `Intl` (`src/price.ts`), and `stripe()` sends `unit_amount = plan.price.amount` unchanged (`src/stripe.ts`), so an ISK 1,500 plan would be charged ISK 15.
> - **Source:** FU-12 retro plan review of MO-2, W1 (`context/archive/2026-10-03-billing-plans-pricing/reviews/plan-review.md`)

The source finding, quoted from that review:

> **W1** "Minor units" are `Intl`'s, not necessarily the provider's. [...] Stripe's currency guide
> lists special cases: ISK and UGX are shown without decimals yet sent ×100, and HUF and TWD amounts
> must be divisible by 100. `stripe()` sends `plan.price.amount` unchanged, so an ISK 1,500 plan
> would be charged ISK 15. **Fix:** The Stripe adapter refuses or scales special-case currencies,
> checked when the config loads; a test per case, and a 3-decimal formatting test (KWD).

## Constraints

- Owns `modules/billing/src/stripe.ts`, `src/price.ts`, the Stripe webhook's amount reading
  (`src/stripe-webhook.ts`), the payment provider contract (`src/payment.ts`, one optional member)
  and the options check (`src/options.ts`). Lane C: FU-26 and later billing items are not done here;
  other gaps go to the followups roadmap as new FU items.
- No Stripe secrets or sandbox calls: unit tests on the Checkout request body and on signed webhook
  fixtures (the sandbox e2e is LT-1).
- English-only code, comments and commits (AGENTS.md). No release, tag or publish (owner).

## Notes

- Research: kept (money; the item starts by confirming Stripe's rule, and the confirmation changed
  the scope: HUF and TWD need nothing for charges, while more currencies than ISK and UGX differ).
- Framing skipped: the problem is stated by the retro finding and confirmed by research; the only
  open choice (scale vs. refuse) is a design decision the plan makes, not a doubt about the problem.
- Archived 2026-10-04: `stripe()` sends amounts in Stripe's unit per currency (ISK, UGX and the other
  `Intl`-zero / Stripe-two currencies ×100), the webhook records paid totals and partial refunds in
  billing's unit, and a price Stripe cannot charge exactly is refused when the config loads through
  the provider's optional `checkPrice`. HUF and TWD needed nothing (Stripe's rule for them is for
  payouts).
