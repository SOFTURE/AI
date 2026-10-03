# Research: billing-refund-one-payment

Input: change.md, roadmap FU-11, archived MO-3 (`billing-provider-adapter`). Depth: deep (money,
a migration, concurrency).
Snapshot: d984697 on claude/project-thread-wsh2og, 2026-10-03 23:30 Europe/Warsaw.

## Summary

- A refund today revokes everything: `refundPayment` applies `{ type: "revoke" }`
  (`modules/billing/src/server/payments.ts:106`), which clears `paid_until` and `is_lifetime`
  (`modules/billing/src/entitlement.ts:58-59`).
- The entitlement is one row with one `paid_until` and one `is_lifetime` flag; periods stack end to
  end (`getPlanGrant` starts a period where current access ends, `src/plans.ts:59-63`), so the
  timeline never has gaps and a "remove one window" model maps to *shifting the end back by the
  window's length*.
- A payment row does not record what it granted (`migrations/0002_create_payments.sql:23-44`), and
  `grantPlan` hides the event it applied (`src/server/plans.ts:41-45`).
- Lifetime erases the dated end (`entitlement.ts:56-57`, CHECK `entitlements_lifetime_without_end`,
  `migrations/0001_create_entitlements.sql:14`), and a dated grant on lifetime is a no-op
  (`entitlement.ts:52`): refunding a lifetime cannot restore months bought next to it.
- Manual grants (admin page, `src/next/actions.ts:74`) go through `grantPlan` with no payment row.
- Recommended: record each payment's grant (kind, from, until) in a new migration; a pure
  `shorten` event plus `end_lifetime`; keep the dated end under lifetime.

## Current state

1. Stripe delivers `charge.refunded`; `parseStripeEvent` returns `payment_refunded` only when
   `refunded: true` (`src/stripe-webhook.ts:154-160`); a partial refund is `ignored`.
2. `receiveStripeWebhook` calls `refundPayment` (`src/server/payments.ts:147-150`).
3. `refundPayment` (`payments.ts:90-111`): reads the payment, takes `key share` on the account,
   flips `status` to `refunded` with a conditional `UPDATE ... WHERE status = 'paid'` (exactly
   once), then `changeEntitlement(..., { type: "revoke" })` in the same transaction.
4. `changeEntitlement` (`src/server/entitlements.ts:79-118`) locks the account (`key share`),
   locks or inserts the entitlement row and applies the event via the pure
   `applyEntitlementEvent`; an event may be a resolver evaluated under the lock.
5. Paying: `recordPayment` (`payments.ts:45-76`) inserts the payment (dedupe by unique
   constraints), then `grantPlan` → `changeEntitlement` with `getPlanGrant` as the resolver.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| State machine | `src/contract.ts`, `src/entitlement.ts` | new events; lifetime keeps the dated end |
| Grant capture | `src/server/plans.ts`, `src/plans.ts` | the applied grant must be returned to the payment |
| Refund | `src/server/payments.ts`, new pure helper | per-payment reversal instead of revoke |
| Data | `migrations/0003_*.sql`, `src/schema.ts` | grant columns on payments, drop the lifetime CHECK |
| Export | `src/server/privacy.ts` | new payment columns are personal data |
| Docs | `modules/billing/README.md` §1, §4, §5, §12 | behaviour and limitations |
| e2e | `examples/next-app/e2e/billing-stripe.spec.ts`, `migrations.spec.ts` | stacked refund; ledger line |

## Data

- `billing.entitlements`: `paid_until` NULL when never paid, revoked or lifetime; CHECK
  `entitlements_lifetime_without_end` (`0001_create_entitlements.sql:14`).
- `billing.payments`: no grant columns; status `paid`/`refunded` with `refunded_at` CHECKs
  (`0002_create_payments.sql:37-43`).
- Nothing is published yet (MO-6 release is an owner batch on 2026-10-05), so no production rows
  exist; still, migrations move forward only and old rows must stay valid (NULL grant columns).

## Tests

- Unit (PGlite): `tests/stripe-payments.test.ts` (record/refund/webhook/privacy),
  `tests/entitlement.test.ts` (pure events), `tests/entitlements.test.ts` (constraints, including
  the lifetime CHECK at line 172-174), `tests/plans.test.ts`, `tests/privacy.test.ts`.
- e2e: `examples/next-app/e2e/billing-stripe.spec.ts` (single payment refund back to trial),
  `migrations.spec.ts` (ledger list). Run with `npm run e2e` against a local Postgres.
- Gap: no test of a refund next to another payment or a lifetime.

## Patterns to follow

- Pure core plus thin server layer: `getPlanGrant` (pure, `src/plans.ts:59`) used as a resolver in
  `grantPlan` (`src/server/plans.ts:44`).
- Calendar arithmetic in local day numbers: `getDayNumber`/`getStartOfDay` (`src/calendar.ts`).
- Migrations carry a header with a rollback recipe (`0002_create_payments.sql:1-6`).
- Lock order account → payment → entitlement (`payments.ts` header, `privacy.ts:71-73`).

## Prior work

- `context/archive/2026-10-03-billing-provider-adapter/reviews/plan-review.md` W4: deferred
  per-payment reversal; Fix B = store grant start/end per payment and add a shortening event.
- `context/archive/2026-10-03-billing-entitlements/`: MO-1 built `revoke` for refunds and the
  lifetime-without-end CHECK.

## SOFTURE modules

Not applicable: this is the billing module itself.

## Risks

- Changing lifetime semantics (dated end kept) could break readers that assume `paid_until` is
  NULL under lifetime: only `resolveEntitlement` reads it and it checks `isLifetime` first
  (`entitlement.ts:21`); the admin notice reads the resolved entitlement (`actions.ts:80`). Low.
- Shifting in milliseconds would drift across DST: shift in local day numbers. Low with tests.
- Race between a lifetime refund and a concurrent lifetime purchase: decide "another lifetime
  payment is still paid" under the entitlement lock. Medium; test the order.
- Conflict with FU-3 on `migrations.spec.ts`: merge master. Low.

## Relevant lessons

- L-001/L-002 (build with tsc, Next imports without `.js`): unchanged surfaces here.

## Answers to unknowns

- **Storing each payment's grant:** yes. Columns `grant_kind` (`period` | `lifetime`, NULL for
  rows recorded before the migration), `granted_from`, `granted_until`, set in the same
  transaction as the grant from the event the resolver actually applied.
- **Shortening event vs. recomputing from remaining payments:** shortening. Recomputing cannot see
  manual grants (no row) nor trial extensions and would need the plan config at refund time (a
  plan may be removed). Shifting the end back by the refunded window's length in local days
  keeps every other grant, manual ones included.
- **Manual grants:** dated manual grants survive (only the refunded window's length is removed).
  A manual *lifetime* is invisible to payments: a refunded paid lifetime ends lifetime unless
  another paid lifetime payment is still `paid`. FU-9 adds a grant history that can close it.
- **Partial refunds (optional):** no cheap rule that is right for money (pro rata by amount vs. by
  days, currency rounding, several partial refunds summing to full). Kept `ignored`; filed.

## Open questions

- Shift by the whole window even when part of it was already used? ~~Decided (auto): yes.~~
  Corrected 2026-10-03 by plan review C1: only the unused part `[max(from, now), until)` is taken
  back. A whole-window shift would charge used time against later payments and, after a lapse
  between payments, take a new period for an old refund.
- Rows from before the migration? **Decided (auto):** keep the old full revoke for them (no grant
  recorded); documented.
- PaymentOutcome name `revoked` no longer describes the effect. **Decided (auto):** rename to
  `refunded` (unreleased API; only tests use it).
