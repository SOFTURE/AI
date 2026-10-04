# Research: billing-partial-refunds

Input: change.md, roadmap FU-20, archived FU-11 (`2026-10-03-billing-refund-one-payment`) and FU-9
(`2026-10-03-billing-manual-payments`). Depth: standard (money and a migration, but the take-back
machinery exists and is reused).
Snapshot: 2e5cc3c on claude/fu-20-ke8s4w, 2026-10-04 04:20 Europe/Warsaw.

## Summary

- A partial refund is dropped at the parser: `readRefund` returns `ignored` when the charge has
  `refunded: false` (`modules/billing/src/stripe-webhook.ts:154-160`).
- A full refund already takes back a payment's unused days, shifts every later stored period and
  ends a lifetime unless another lifetime pays for it (`src/server/take-back.ts:110-126`,
  `src/refund.ts:58-63`). A partial refund only needs a smaller number of days on the same path.
- The payment row records its grant (`grant_kind`, `granted_from`, `granted_until`, migration
  0003) but not how much of it was refunded; a cumulative `refunded_amount` column is the missing
  state (migration 0005).
- Stripe's `charge.refunded` fires on every refund, partial or full, and carries the cumulative
  `amount_refunded`; `refunded` turns true when the whole charge is refunded. A cumulative value
  makes deliveries idempotent: a value not above the stored one changes nothing.
- Recommended policy, default `pro_rata`: each refund takes back the share of the payment's
  still unused days that the newly refunded money is of the money not refunded before, rounded
  down to whole local days; the refund that reaches the full amount takes back every unused day
  left, so partial refunds summing to the full amount equal one full refund. Option
  `partialRefunds: "keep_access"` for apps that use partial refunds as goodwill.

## Current state

1. `parseStripeEvent` → `readRefund`: a charge without `payment_intent` is `ignored`, a charge with
   `refunded: false` is `ignored` ("a partial refund"), otherwise `payment_refunded { paymentId }`.
   `chargeSchema` reads only `payment_intent` and `refunded` (`stripe-webhook.ts:118-121`).
2. `receiveStripeWebhook` calls `refundPayment(ctx, { provider, paymentId })` (`payments.ts:177-181`).
3. `refundPayment` (`payments.ts:120-143`): reads the payment, locks the account (key share) and the
   entitlement row (`lockEntitlementRow`, FOR UPDATE), flips `status` to `refunded` with a
   conditional `UPDATE ... WHERE status = 'paid'`, then `takeBackGrant`.
4. `takeBackGrant` (`take-back.ts:110-126`): `getTakeBackEvent` → `revoke` for a row without a
   grant, nothing for a lifetime another lifetime still pays for, else `getRefundEvent`; for a
   period with an event it first moves later stored periods back (`shiftLaterPeriods`, payments
   and manual grants starting at or after the refunded period's end) by `getUnusedDays`.
5. `getRefundEvent(record, grant, now, timezone)` (`refund.ts:58-63`): period → `shorten` to
   `paidUntil` moved back by `getUnusedDays` local days; lifetime → `end_lifetime`. It is exported
   from the package root (`src/index.ts:110`); only `take-back.ts` and `tests/refund.test.ts` call it.
6. The admin history shows a provider payment as "Paid" or "Refunded on {date}"
   (`src/next/pages.tsx:191-202`, copy `admin.history.*` in `src/messages/{en,pl}.ts`).
7. The export lists each payment's columns (`src/server/privacy.ts:84-102`).

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Webhook | `src/stripe-webhook.ts` | read `amount_refunded`; a partial-refund event |
| Policy | `src/options.ts` | `partialRefunds` option with a default |
| Pure rule | `src/refund.ts`, `src/index.ts` | days a partial refund takes back |
| Refund | `src/server/payments.ts`, `src/server/take-back.ts` | cumulative amount, idempotency, shrink the payment's own period |
| Data | `migrations/0005_record_refunded_amounts.sql`, `src/schema.ts` | `refunded_amount` with CHECKs |
| Admin / export | `src/server/grants.ts`, `src/next/pages.tsx`, `src/messages/{en,pl}.ts`, `src/server/privacy.ts` | show and export the refunded amount |
| Docs | `modules/billing/README.md` §3, §4 webhook table, §5, §11, §12 | policy and limitations |
| e2e | `examples/next-app/e2e/migrations.spec.ts` | ledger line `billing 5 ...` |

## Data

- `billing.payments.amount bigint NOT NULL CHECK (amount >= 0)`; `status` `paid`/`refunded` with
  `payments_refunded_at_with_status` (`0002_create_payments.sql:37`).
- Nothing is published yet (MO-6 release is the owner's batch on 2026-10-05), but migrations move
  forward only: existing `refunded` rows get `refunded_amount = amount`, `paid` rows 0.
- A free checkout (`no_payment_required`) has `amount = 0`; a full refund of it must still flip
  the status (it has no `payment_id`, so Stripe never names it, but `refundPayment` is public).

## Tests

- Pure: `tests/refund.test.ts` (`getUnusedDays`, `getRefundEvent`), `tests/stripe-webhook.test.ts`
  (`parseStripeEvent` for `charge.refunded`, the partial case expects `ignored` today at line ~80).
- PGlite: `tests/stripe-payments.test.ts` (refund, stacked payments, lifetime, webhook end to end with
  `signature()`), `tests/grants.test.ts` (refund next to manual grants), `tests/privacy.test.ts`,
  `tests/admin-ui.test.tsx` (history lines), `tests/module.test.ts` (options).
- Fixture `charge(paymentIntent, refunded)` already sends `amount: 2900` and `amount_refunded`
  (2900 or 900) (`tests/stripe-fixtures.ts:33-35`); the e2e sends `refunded: true` without
  `amount_refunded` (`examples/next-app/e2e/billing-stripe.spec.ts:117,144`), so the full path must
  not require it.

## Patterns to follow

- Pure core plus thin server layer (`getRefundEvent` used under the lock in `takeBackGrant`).
- Local day arithmetic (`getDayNumber`, `moveBackByDays`), never milliseconds.
- Lock order account (key share) → entitlement (`lockEntitlementRow`) → own row (conditional
  `UPDATE`), as in `refundPayment` and `revokeManualGrant`.
- Migration header with a rollback recipe (`0004_create_requests_and_grants.sql:1-7`).
- Options: `z.strictObject` keys with a JSDoc line and a `.default` (`src/options.ts`).

## Prior work

- FU-11 research, "Partial refunds (optional)": "no cheap rule that is right for money (pro rata by
  amount vs. by days, currency rounding, several partial refunds summing to full). Kept `ignored`;
  filed." This change answers each of those.
- FU-9: `takeBackGrant` shared with `revokeManualGrant`; `shiftLaterPeriods` keeps the stored
  periods of later payments and manual grants consistent.

## SOFTURE modules

Not applicable: this is the billing module itself.

## Risks

- A failed refund (Stripe `refund.failed`, rare, card or bank rejects it) lowers
  `amount_refunded` again; billing keeps the days it took back. Same as a failed full refund today.
  Low; documented, and filed as a followup.
- Rounding: pro rata of whole days rounds down, so the customer keeps a partial day; the last
  refund covers the rest exactly. Low.
- A refund delivered before an earlier one (Stripe does not order events) carries a larger
  cumulative amount; the earlier one then arrives with a smaller value and changes nothing. The sum
  is still exact. Low.
- `getRefundEvent` signature change on an unreleased export. Low.

## Relevant lessons

- L-001/L-002 (build with tsc, Next imports without `.js`): unchanged surfaces.

## Answers to unknowns

- **Pro rata by amount vs. a fixed rule:** pro rata by amount, applied to the unused days at the
  time of the refund: `days = floor(unusedDays × newlyRefunded / notRefundedBefore)`. Measuring
  against the money not refunded before (not the original amount) makes the last refund's share
  exactly 1, so a series of partial refunds ends where one full refund does, whatever their timing.
  A fixed rule (any partial refund = full, or = nothing) is the `keep_access` option's job only at
  the "nothing" end; "partial = full" punishes goodwill refunds.
- **Rounding of days:** down, in local days of the app's time zone (`moveBackByDays`); the time of
  day of the end is kept. The refunded payment's stored period shrinks by the same days, and every
  later stored period moves back by them, so the next refund of either computes from true dates.
- **Tracking the refunded amount:** `billing.payments.refunded_amount bigint NOT NULL DEFAULT 0`,
  set from `charge.amount_refunded` (cumulative), clamped to `amount`; a delivery whose cumulative
  amount is not above the stored one is `duplicate`. `status` turns `refunded` (with `refunded_at`)
  when the charge is fully refunded (`refunded: true`) or the cumulative amount reaches `amount`.
- **Policy as an option of `billing()`:** yes, `partialRefunds: "pro_rata" | "keep_access"`,
  default `pro_rata`. `keep_access` still records the amount, so the refund that completes the sum
  takes back what a full refund would.
- **Lifetime:** has no days to share: a partial refund keeps lifetime; the refund that completes the
  amount ends it (unless another lifetime pays for it), under both policies.
- **Payment stored before 0003 (no grant):** a partial refund records the amount and takes nothing;
  the completing refund revokes as today.

## Open questions

- Currency: the charge's currency is not compared with the payment's. A Checkout payment has one
  charge in the session's currency, so they match. **Decided (auto):** not checked; noted in the plan.
