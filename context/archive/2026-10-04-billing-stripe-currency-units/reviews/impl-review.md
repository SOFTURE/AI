# Implementation review: billing-stripe-currency-units

Reviewed: the branch diff (`modules/billing/{src/stripe-currency.ts,src/stripe.ts,src/stripe-webhook.ts,src/payment.ts,src/options.ts,src/index.ts,README.md,tests/}`)
against plan.md and the plan review. Verdict: **approved**, no open findings.

## Plan conformance

| Step | Result |
| --- | --- |
| Phase 1, step 1: `stripe-currency.ts` | Done: the two Stripe lists (source and date named, plan review S2), `getStripeMinorUnitDigits`, `toStripeAmount`, `fromStripeAmount`, `describeStripePriceProblem` (null exactly when the conversion succeeds, S1). |
| Step 2: adapter | Done: `unit_amount` through `toStripeAmount`; `startPayment` refuses an unchargeable price before any call; `getCheckoutSessionParams` throws for it (a bug once the config refuses it); `checkPrice` on the provider. |
| Step 3: webhook | Done: `amount_total` and `amount_refunded` converted by currency; a partial refund without `currency` is unreadable; fixtures send the charge's currency. |
| Step 4: contract and options | Done: optional `checkPrice`; `isPaymentProvider` refuses a non-function (W1, tested); a top-level `superRefine` reports at `plans[i].price`. |
| Steps 5-6: tests, README | Done: per-currency conversion, every `Intl` currency cross-checked, Checkout body (ISK, UGX, ALL, JPY, HUF, TWD, KWD), config refusal under `stripe()` and acceptance under `manual()`, ISK checkout plus partial and full refund through the handler on PGlite (W2), KWD formatting; README "Stripe's currency units". |

## Checks

| Check | Result |
| --- | --- |
| Correctness | Conversion is a power of ten by the digit difference; a negative shift divides only when exact. Round trip tested for ISK, PLN, LYD. `Intl` and Stripe agree on every zero- and three-decimal currency in Stripe's lists (asserted, so a runtime CLDR change fails a test). |
| Tests that bite | Sending `plan.price.amount` unchanged fails the ISK/UGX/ALL Checkout test; dropping the webhook conversion fails the PGlite test (stored 150000, refunded 50000). |
| Money safety | Nothing is rounded on the way to Stripe; on the way back a fraction rounds down, so a refunded total is never over-counted and a full refund still compares equal. |
| Errors | Config refusals name the plan and the rule; the buyer path returns `billing.payment_failed` with a log line that carries no secret. |
| Compatibility | `checkPrice` is optional, so `manual()` and custom providers are unchanged. Existing payments: none in Stripe's other unit (Stripe is not live, LT-1). |
| Docs | README states the unit rule, the HUF/TWD payout clarification and what Stripe still checks at Checkout. |
| Gates | `npm run typecheck`, `npm run lint` (ESLint and the language gate), `npm test` (all packages), `npm run build`. |

## Findings

None. No new gaps for the followups roadmap: Stripe's minimum and maximum amounts and unsupported
currencies are Stripe's own refusals at Checkout (research "Not gaps").
