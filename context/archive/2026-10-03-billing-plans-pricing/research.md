# Research: billing-plans-pricing

Written after the fact by FU-12 (`billing-retro-reviews`, 2026-10-04): MO-2 went from change.md
straight to plan.md. This answers MO-2's roadmap unknowns as the code stands today, and names what
later changes (MO-3, FU-11, FU-9) changed in MO-2's design.

Input: change.md, backlog-input.md (roadmap MO-2). Depth: deep (money). Snapshot: b6c92c4 (master,
2026-10-04).

## Summary

- Plans are config (`billing({ plans })`), one currency each, prices in the currency's minor unit;
  formatting uses `Intl`, so 0- and 3-decimal currencies display right. The Stripe adapter passes
  the amount through unchanged, which is wrong for Stripe's special-case currencies (ISK, UGX, and
  the divisibility rule for HUF, TWD), to be confirmed against Stripe's guide.
- The admin surface is a page with role-guarded actions; there is no ops script (FU-22).
- No price table: provider payments record the price paid (`billing.payments`), manual grants do not.
- Manual requests, unstored in MO-2, are stored since FU-9; the owner is still told before the
  request is stored.
- `PaymentProvider` has needed no change since MO-2: Stripe (MO-3) fits it as is.

## Current state

- **Plans.** Options schema `src/options.ts` (ISO 4217 code `/^[A-Z]{3}$/` and `isSupportedCurrency`,
  `:43`; unique ids; period shorthand or `{ unit, count }`). Pure helpers in `src/plans.ts`:
  `getPeriodEnd` (local days, month clamp, `:23-47`), `getPlanGrant` (a period starts where access
  ends, `:59-63`).
- **Prices.** `formatPrice` and `getMinorUnitDigits` take the digits from `Intl`
  (`src/price.ts:20-31`): JPY 0, KWD and BHD 3, PLN 2. Tests cover PLN, EUR, USD, JPY
  (`tests/price.test.ts:11-23`), no 3-decimal currency.
- **Manual flow.** Tile → `/payment?plan=` → `startPaymentAction` checks the session first
  (`src/next/actions.ts:44`) → `startPayment` (`src/server/plans.ts:118-137`): setup check, the
  `billing-payment` bucket first (5 per 60 minutes per account, `src/index.ts:20`), the plan, a
  lifetime refusal (since FU-9), invoice details, then the provider; `onRequest` mails the owner in
  the example (`examples/next-app/lib/invoice-requests.ts:15-36`), and only after that the request
  is stored (`plans.ts:136`, `src/server/requests.ts:43-58`).
- **Admin grant.** `BillingAdminPage` (`src/next/pages.tsx:214-216`) answers "not found" without
  `adminRole`; every admin action calls `authorizeAdmin` before reading the form
  (`actions.ts:66-67,77,120,162`). Since FU-9 a grant goes through `grantPlanManually`
  (`src/server/grants.ts:43-60`) and is recorded in `billing.manual_grants`.
- **Invoice details.** `parseInvoiceDetails` trims, requires name and address, caps 200/32/500
  characters (`plans.ts:91-101`, `src/fields.ts:13-17`); the database repeats the caps as CHECKs
  (`migrations/0004_create_requests_and_grants.sql:14-16`). No control-character check; one error
  text for "missing" and "too long" (`src/messages/en.ts:109`).
- **PaymentProvider.** `{ name, collectsInvoiceDetails, startPayment(ctx, { plan, account, invoice,
  returnUrl }) → Ok<redirect | requested> | Err<billing.payment_failed> }` (`src/payment.ts:43-53`),
  one commit (8b6bbae). `stripe()` implements it (`src/stripe.ts:80-117`) and sends
  `unit_amount = plan.price.amount` (`:53`).

## Data

- `billing.payments` (MO-3): `plan_id`, `amount`, `currency` as the provider reported them, grant
  columns since FU-11 (`src/schema.ts:17-32`).
- `billing.payment_requests` (FU-9): `plan_id`, invoice details while open, cleared on close by a
  CHECK-enforced `UPDATE` (`0004:8-25`).
- `billing.manual_grants` (FU-9): `plan_id`, grant kind and window, granted/revoked by, request id;
  no amount or currency (`0004:31-56`).

## Tests

`tests/plans.test.ts` (periods, clamp, leap year, grant start), `tests/payments.test.ts`
(`grantPlan`, `startPayment`: bucket, lifetime, fields, failures, redirect), `tests/grants.test.ts`
(requests, grant, revoke, history), `tests/pricing.test.tsx`, `tests/admin-ui.test.tsx`,
`tests/messages.test.ts`; e2e `examples/next-app/e2e/billing-pricing.spec.ts` (9 tests). Gaps: no
test calls the server actions as an anonymous or non-admin user (only the page guard, e2e `:156`);
concurrent grants are tested on PGlite only (`tests/payments.test.ts:50`).

## Patterns to follow

Result values for expected failures, the bucket counted first (security module), role checks
through auth's `authorizeRole`, `Intl` for formatting, `sft:` tokens, copy in `src/messages/`.

## Prior work

- MO-1 `archive/2026-10-03-billing-entitlements/`: `changeEntitlement` under a row lock, calendar
  days in the app's zone; grants extend, never shorten.
- FIRE_TRACKER (per the roadmap baseline): hard-coded prices, access granted with a script.
- Later changes to MO-2's design:
  - MO-3 `archive/2026-10-03-billing-provider-adapter/`: kept `PaymentProvider` (`research.md:8,77`);
    one-time Checkout because `grantPlan` stacks periods (`plan.md:16`).
  - FU-11 `archive/2026-10-03-billing-refund-one-payment/`: `applyPlan` / `grantPlan` return the
    grant they applied; a dated grant to a lifetime account extends the end kept under lifetime.
  - FU-9 `archive/2026-10-03-billing-admin-requests/`: requests stored by `startPayment`; admin
    grants recorded and revocable; `billing.lifetime_active` from payment and grant; `grantPlan`
    stays as an unrecorded path (`modules/billing/README.md` §12).

## SOFTURE modules

Covered: auth (roles, session), security (rate limit), core (Result, clock, config), ui (tokens,
button). Billing is the module that covers plans and payments.

## Risks

- Money: a currency whose provider unit differs from `Intl`'s digits charges the wrong amount
  (likely only for ISK/UGX/HUF/TWD; mitigation: refuse or scale in the adapter).
- Privacy: invoice details of an open request are kept until someone closes it.
- Consistency: the owner is mailed before the request is stored.

## Answers to unknowns

1. **Admin surface for granting access (page vs. CLI):** a page with role-guarded actions
   (`pages.tsx:214`, `actions.ts:66-67`), driven by the e2e; the CLI is FU-22.
2. **Multi-currency formatting through messages:** one currency per plan, `Intl.NumberFormat` in the
   viewer's locale, amounts in minor units (`price.ts:20-31`). Display is right for 0- and 3-decimal
   currencies; the provider's units are a separate question (Risks).
3. **A DB table for price history:** none needed for plans (config, a deploy changes a price).
   Stored rows keep `plan_id` and their own window, so a price or period change never rewrites the
   past; a removed plan shows its raw id in the history (`pages.tsx:132-135`) and an open request
   for it can only be dismissed (`grants.ts:43`). Provider payments store the price paid; manual
   grants do not (`0004:31-56`).

## Open questions

- Stripe special-case currencies: **decided (auto):** filed as FU-25, starting by confirming the rule
  in Stripe's currency guide (not fetchable from the FU-12 session).
- Snapshot of the price on manual grants: **decided (auto):** filed with the request hygiene, FU-27.
