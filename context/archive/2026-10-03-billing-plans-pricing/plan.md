# Plan: billing-plans-pricing

Input: change.md, backlog-input.md. Complexity: medium (2 phases). Risk: low.

## Goal

- Plans from config, pricing tiles, a payment page, the manual adapter and an admin grant that
  flips a trial to paid (e2e), with a `PaymentProvider` contract Stripe (MO-3) fits.

## Approach

| Decision | Choice | Why |
| --- | --- | --- |
| Admin surface (unknown 1) | a page (`BillingAdminPage`) with a role-guarded action | the e2e can drive it; FIRE's script needs shell access to production |
| Multi-currency (unknown 2) | one currency per plan, `Intl.NumberFormat` by locale, minor units | providers (Stripe `unit_amount`) take minor units; no rounding |
| Price history (unknown 3) | no table: plans are config, payment records belong to the provider | the roadmap's Group B allows one migration (MO-5) |
| Period start | where current access ends (trial or paid) | paying early loses no day |
| Period length | local calendar days, the start day counted, months clamp to the last day | same rule as trials (MO-1) |
| Concurrent grants | event resolver run under `changeEntitlement`'s row lock | two grants add two periods |
| Manual requests | handed to `onRequest`, not stored | no migration; the app decides how its owner hears of it |
| Provider contract | `name`, `collectsInvoiceDetails`, `startPayment` → redirect / requested / `billing.payment_failed` | a hosted checkout (Stripe) is a redirect; `grantPlan` is its webhook's write |
| Abuse | `billing-payment` bucket per account, counted first | each request mails the owner (or creates a checkout) |

## Phase 1: Module

**Discipline:** TDD.

- Contract, options, plans, price, payment, manual, server, ui, next, messages, manifest (`security`).
- Tests: periods across DST and month ends, grants, prices, options, grant and payment on PGlite,
  components, messages.

## Phase 2: Example app, e2e, docs

- Example config, `/pricing`, `/payment`, `/admin/billing`, invoice mail; `e2e/billing-pricing.spec.ts`;
  README; the followups gap.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Module

#### Automated
- [x] 1.1 Period, grant, price, options, grant and payment tests pass on PGlite — 8b6bbae
- [x] 1.2 Component and messages tests pass; `module.json` equals the manifest — 8b6bbae
- [x] 1.3 Gates green (typecheck, lint, test) — 8b6bbae

### Phase 2: Example app, e2e, docs

#### Automated
- [x] 2.1 Example app builds; `e2e/billing-pricing.spec.ts` and the existing specs pass — 1e2a3d3
- [x] 2.2 Gates green (typecheck, lint, test, build) — 1e2a3d3
