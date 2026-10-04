# Plan: billing-stripe-currency-units

Input: change.md, research.md. Complexity: small.

## Goal

- `stripe()` sends `unit_amount` in Stripe's unit: ISK 1,500 (`amount: 1500`) goes as `150000`,
  ALL and the other `Intl`-zero / Stripe-two currencies likewise; PLN, JPY and KWD unchanged.
- A paid checkout and a partial refund are recorded in billing's unit: an ISK checkout with
  `amount_total: 150000` is stored as `1500`.
- `billing({ payment: stripe(), plans })` refuses, when the config loads, a price Stripe cannot
  charge exactly (a three-decimal amount whose last digit is not 0; an amount with more `Intl`
  digits than Stripe's, e.g. LYD), naming the plan.
- `formatPrice` is tested for KWD.

**Out of scope:** Stripe's minimum and maximum charge amounts and currencies Stripe does not support
(research "Not gaps"); FU-26 and later lane C items; README sections other than the Stripe and plan ones.

## Approach

**Starting point:** `getCheckoutSessionParams` (`src/stripe.ts:47-67`) sends `plan.price.amount`;
`readCheckout` / `readRefund` (`src/stripe-webhook.ts:131-168`) pass Stripe's amounts through;
options validate the currency only with `isSupportedCurrency` (`src/options.ts:51`).

**Chosen:** research option A. A new `src/stripe-currency.ts` owns Stripe's two lists and three pure
functions; the adapter and the webhook call them; `PaymentProvider` gains an optional
`checkPrice(price): string | null` that `billingOptionsSchema` runs for every plan when a provider is
set. Rejected: refusing ISK/UGX (option B), Stripe-unit config (option C), a check inside
`startPayment` only (the buyer would meet it, not the deployer).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Stripe digits | 0 for the zero-decimal list (without UGX), 3 for BHD JOD KWD OMR TND, 2 otherwise | Stripe's rule; ISK/UGX are "two-decimal with 00" | research |
| To Stripe | `amount × 10^(stripe − intl)`; when negative, divide only if exact, else unchargeable | never round money silently | plan |
| Three-decimal | unchargeable unless Stripe amount % 10 = 0 | A2 | research |
| From Stripe | `amount ÷ 10^(stripe − intl)`, rounded down when not whole | a refund total is never over-counted; a paid total of a Checkout we created is always whole | plan |
| Where refused | `checkPrice` on the provider, run by the options schema | the config names the plan; manual() is unaffected | plan |
| Charge currency | read `charge.currency` for a partial refund; missing → the event is unreadable (as a missing amount is) | Stripe sends it on every charge | research |

## Phase 1: Stripe units

**Discipline:** TDD. **Files:** `src/stripe-currency.ts` (new), `src/stripe.ts`, `src/stripe-webhook.ts`,
`src/payment.ts`, `src/options.ts`, `src/index.ts`, `tests/stripe-currency.test.ts` (new),
`tests/stripe.test.ts`, `tests/stripe-webhook.test.ts`, `tests/stripe-fixtures.ts`, `tests/price.test.ts`,
`tests/module.test.ts` or the options tests, `README.md`

1. `src/stripe-currency.ts`: `STRIPE_ZERO_DECIMAL_CURRENCIES`, `STRIPE_THREE_DECIMAL_CURRENCIES`
   (sets, source named), `getStripeMinorUnitDigits(currency)`, `toStripeAmount(price): number | null`,
   `fromStripeAmount(amount, currency): number`, `describeStripePriceProblem(price): string | null`.
2. `stripe.ts`: `getCheckoutSessionParams` sends `toStripeAmount` (throws on null: the config refused
   it, so reaching it is a bug); `startPayment` returns `billing.payment_failed` with a log line before
   building the params when the price is unchargeable (a hand-built config); the provider implements
   `checkPrice`.
3. `stripe-webhook.ts`: `readCheckout` converts `amount_total` by the session currency; `chargeSchema`
   reads `currency`; `readRefund` converts `amount_refunded`. Fixtures send `currency: "pln"` on charges.
4. `payment.ts`: optional `checkPrice?(price: PlanPrice): string | null`; `isPaymentProvider` accepts
   it missing or a function (plan review W1). `options.ts`: a top-level `superRefine` adds an issue at
   `plans[i].price` with the provider's message.
5. Tests: per-case conversion (PLN, JPY, ISK, UGX, ALL, HUF, TWD, KWD ok/refused, LYD), the Checkout
   body for ISK and KWD, config refusal naming the plan, webhook ISK checkout and partial refund,
   KWD formatting.
6. README: the Stripe section says amounts stay in `Intl`'s unit and the adapter converts; the plan
   section names the refusal.

## Risks and rollback

- A1/A2 wrong: one constant to edit. Rollback: revert the commit; no migration, no stored data
  changes shape (payments already recorded in Stripe's unit for affected currencies stay as they are;
  none exist, Stripe is not in production).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Stripe units

#### Automated
- [ ] 1.1 `unit_amount` is Stripe's unit for ISK, UGX, ALL; unchanged for PLN, JPY, HUF, TWD, KWD
- [ ] 1.2 A price Stripe cannot charge exactly fails config parsing, naming the plan; manual() accepts it
- [ ] 1.3 Webhook amounts (paid checkout, partial refund, full refund) are recorded in billing's unit through the handler
- [ ] 1.4 KWD formats with three decimals
- [ ] 1.5 Gates green (typecheck, lint, test, build)
