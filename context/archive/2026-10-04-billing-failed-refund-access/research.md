# Research: billing-failed-refund-access

Input: change.md, roadmap FU-30, archived FU-20 (`2026-10-04-billing-partial-refunds`), FU-11
(`2026-10-03-billing-refund-one-payment`) and FU-21. Depth: standard (money, a migration and
webhook ordering; the take-back machinery exists and is reused in reverse).
Snapshot: dc3fa02 on claude/project-thread-8sum2d, 2026-10-04 10:20 Europe/Warsaw.

## Summary

- Billing hears of refunds only through `charge.refunded` and its cumulative `amount_refunded`;
  a total not above the stored one is `duplicate` (`src/server/payments.ts`, `refundPayment`).
  A refund that fails later is never seen: the access and the `refunded` status stay.
- A lower cumulative total cannot tell a failure from a stale delivery (Stripe does not order
  events), so it is not the signal. Stripe's Refund events name the refund itself: `refund.failed`
  (and `refund.updated` / the older `charge.refund.updated` with `status: failed` or `canceled`)
  carry the refund id, its amount, its `payment_intent` and its `created` time. A failure recorded
  by refund id is idempotent.
- What a refund took is not stored: `refundPayment` gets the days from `takeBackGrant` and, for a
  partial refund, moves the payment's `granted_until`; a full refund leaves the row's period as it
  was. A cumulative `taken_back_days` on the payment is the missing state.
- Every Stripe event carries `created` (Unix seconds, when the event and its object snapshot were
  made). With it, a charge snapshot taken before a failure (it still counts the failed refund) can
  be corrected, and a failure that arrives before billing ever counted its refund can be told apart.

## Current state

1. `parseStripeEvent` (`src/stripe-webhook.ts`) acts on `checkout.session.*` and `charge.refunded`;
   the envelope schema reads `id`, `type`, `data.object` (not `created`). Every other type is
   `ignored`.
2. `refundPayment(ctx, { provider, paymentId, amountRefunded? })`: locks account (key share) →
   `lockEntitlementRow` → payment row (FOR UPDATE); `status !== 'paid'` → `duplicate`; total =
   `amountRefunded ?? amount` clamped; not full and not above `refunded_amount` → `duplicate`;
   flips status / amount; `takeBackGrant` returns `{ entitlement, days }`; a partial refund moves
   `granted_until` back by `days`.
3. `takeBackGrant` (`src/server/take-back.ts`): `shiftLaterPeriods` moves paid payments and active
   manual grants starting at or after the refunded period's end back by the days, then
   `changeEntitlement` with `shorten` / `end_lifetime` / `revoke`.
4. `applyEntitlementEvent` `grant { until }` never shortens and needs `until > now`; `shorten` to
   the trial's end or before drops paid access (`paid_until` NULL) (`src/entitlement.ts`).
5. `getPaymentGrant` (`src/refund.ts`) starts a period at the latest of the trial's end, dated paid
   access and now: the same start a grant "at the end" needs.
6. Migration `0005` CHECK `payments_refunded_amount_by_status`: `refunded` ⇔ `refunded_amount =
   amount`; `paid` ⇔ `refunded_amount < amount` (or `amount = 0`).
7. The e2e (`examples/next-app/e2e/billing-stripe.spec.ts:64`) builds events without `created`;
   the unit fixture `stripeEvent` (`tests/stripe-fixtures.ts`) neither.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Webhook | `src/stripe-webhook.ts` | envelope `created`; Refund events with a failed status |
| Pure rule | `src/refund.ts` | days a failed refund gives back; move forward by days |
| Refund | `src/server/payments.ts`, `src/server/take-back.ts` | taken days, snapshot time and correction; `failRefund`; shift forward |
| Data | `migrations/0007_record_failed_refunds.sql`, `src/schema.ts` | `taken_back_days`, `refunds_seen_at`, `billing.refund_failures` |
| Route | `src/next/route.ts` | the new outcome passes through |
| Export | `src/server/privacy.ts` | the account's refund failures |
| Docs | `modules/billing/README.md` §1, §4, §5, §11, §12 | events to subscribe, rules, table, limitation gone |
| e2e | `examples/next-app/e2e/migrations.spec.ts`, `billing-stripe.spec.ts` | ledger line `billing 7`; `created` on events |

## Tests

- Pure: `tests/stripe-webhook.test.ts`, `tests/refund.test.ts`.
- PGlite: `tests/partial-refunds.test.ts` (fixtures, `readPayment`), `tests/stripe-payments.test.ts`,
  `tests/grants.test.ts` (a refund next to manual grants), `tests/privacy.test.ts`,
  `tests/lock-races.test.ts`.

## Patterns to follow

- Pure core (`getRefundEvent`, `getTakenBackDays`) plus a thin server layer under the locks.
- Lock order account (key share) → `lockEntitlementRow` → own row; idempotency by a unique key and
  `ON CONFLICT DO NOTHING` (as `recordPayment`).
- Local day arithmetic (`moveBackByDays`), never milliseconds.
- Migration header with a rollback recipe.

## Risks

- A charge snapshot and a failure inside the same second: `created` has second precision; a refund
  created in the snapshot's second counts as included (Stripe makes the snapshot at or after the
  refund). Low.
- Days given back by share: a failed partial refund restores the failed money's share of the days
  refunds took (rounded down; the last failure restores the rest), not the exact days that refund
  took at its time. Low; all failures together restore exactly what was taken.
- Rows refunded before `0007` have `taken_back_days = 0`: their failure restores the status and the
  amount but no days. Nothing is published yet (MO-6 release is the owner's batch). Low.

## Answers to unknowns

- **Which event to trust:** the Refund events (`refund.failed`; `refund.updated` and
  `charge.refund.updated` when `status` is `failed` or `canceled`), deduplicated by refund id in
  `billing.refund_failures`. A lower cumulative `amount_refunded` stays a stale delivery, but a
  charge snapshot is corrected by the failures it still counts (refund created at or before the
  snapshot, failed after it).
- **A failure billing never counted** (its refund was created after the newest snapshot billing
  recorded, or the failure's own time is before that snapshot): recorded, nothing given back; a later
  snapshot that still counts it is corrected.
- **How to give back days:** the days refunds took are stored per payment (`taken_back_days`). When
  the payment still has unused days ahead (paid, `granted_until > now`), they are put back right
  after its period: dated access and every later stored period move forward (the exact inverse of
  the take-back). Otherwise (refunded in full, or used up) they are a grant at the end of the stack,
  from the latest of the trial's end, dated access and now, and the payment's stored period becomes
  that grant.
- **Lifetime:** a failed refund that brings a fully refunded lifetime payment back below its amount
  grants lifetime again.
- **Policy:** under `pro_rata` the failed money's share of the taken days; under `keep_access` every
  taken day once the payment is no longer refunded in full (partial refunds took none).

## Open questions

None.
