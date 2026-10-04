# Plan: billing-failed-refund-access

Input: change.md, research.md. Complexity: medium (a migration, a new webhook event, the take-back
run in reverse; one existing pattern for each).

## Goal

A Stripe refund that fails after billing acted on it (`refund.failed`, or `refund.updated` /
`charge.refund.updated` with `status` `failed` or `canceled`) gives the account back the access that
refund took: the payment's `refunded_amount` drops by the failed amount, a payment refunded in full
turns `paid` again, a lifetime comes back, and a period gets back its share of the days refunds took.
The same failure delivered twice, a failure of a refund billing never counted, and a charge snapshot
taken before the failure but delivered after it change nothing twice.

**Out of scope:** FU-32, FU-33, FU-34 and other lane C items; a call to Stripe's API from the
webhook; failures of manual grants (they have no provider); admin page copy (the history already
shows status and refunded amount from the row).

## Approach

**Starting point:** `refundPayment` (`src/server/payments.ts`) only ever raises `refunded_amount`;
`parseStripeEvent` (`src/stripe-webhook.ts`) ignores Refund events; nothing records the days a
refund took.

**Chosen:** act on Stripe's Refund events, deduplicated by refund id in a new table
`billing.refund_failures`; store the days refunds took (`payments.taken_back_days`) and the time of
the newest charge snapshot billing recorded (`payments.refunds_seen_at`); correct each charge
snapshot by the failures it still counts. Give days back as the inverse of the take-back while the
payment's period is still ahead, else as a grant at the end.
Rejected: trusting a lower cumulative `amount_refunded` (indistinguishable from a stale delivery);
fetching the charge from Stripe in the webhook (a network call and a secret in a path tested with
fixtures only, and still racy); recomputing the days from dates (time has moved, so the result
would differ from what was taken).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Signal | Refund object events with status `failed` / `canceled` | they name the refund; idempotent by id | research |
| Idempotency | `billing.refund_failures` PK `(payment_id, refund_id)`, `ON CONFLICT DO NOTHING` | a database constraint, like checkout ids | research |
| Stale snapshots | effective total = `amount_refunded` − failures with `refund_created_at ≤ snapshot < failed_at` | the snapshot still counts those | research |
| Never-counted failure | counted iff `refund_created_at ≤ refunds_seen_at < failed_at`; else recorded only | the stored total never included it | research |
| Days given back | `pro_rata`: `floor(taken × restored / refundedBefore)`, all when the total drops to 0; `keep_access`: all once below the amount | mirrors FU-20's share rule; the last failure returns the rest | research |
| Where days go | inverse insertion after the payment's period when paid and `granted_until > now`; else a grant at the end | the roadmap's "grant at the end" when the original place is gone | research |
| Lifetime | a fully refunded lifetime brought below its amount grants lifetime again | the outcome asks for the access back | research |
| Payment without a grant (before `0003`) | status and amount only, no access change | the revoke took an unknown amount of access | plan |
| `created` | required on `charge.refunded` and Refund events; billing's events otherwise unchanged | Stripe always sends it; ordering needs it | plan |
| Outcome | new `{ status: "refund_failed", entitlement }` | the receipt says what happened | plan |

**Critical details:**
- The failure takes the same locks in the same order as `refundPayment` (account key share →
  `lockEntitlementRow` → payment row FOR UPDATE), and inserts its failure row after them, so a
  refund and a failure of one payment never interleave.
- `taken_back_days` counts days refunds took from this payment's period (partial and full); the
  inverse insertion moves later periods forward with the same filter the take-back moves them back
  with (paid payments and active manual grants starting at or after the payment's period end).
- `refund_created_at ≤ snapshot`: second precision, a refund created in the snapshot's second
  counts as included.

## Phase 1: Failed refunds give back access

**Discipline:** TDD. **Files:** `modules/billing/migrations/0007_record_failed_refunds.sql`,
`src/schema.ts`, `src/stripe-webhook.ts`, `src/refund.ts`, `src/server/payments.ts`,
`src/server/take-back.ts`, `src/server/index.ts`, `src/next/route.ts`, `tests/stripe-fixtures.ts`,
`tests/stripe-webhook.test.ts`, `tests/refund.test.ts`, new `tests/failed-refunds.test.ts`.

1. `migrations/0007_record_failed_refunds.sql`: `payments.taken_back_days integer NOT NULL DEFAULT
   0 CHECK (>= 0)`; `payments.refunds_seen_at timestamptz` backfilled to `COALESCE(refunded_at,
   now())` where `refunded_amount > 0`; table `refund_failures (payment_id uuid REFERENCES payments
   ON DELETE CASCADE, refund_id text, amount bigint CHECK (>= 0), refund_created_at timestamptz,
   failed_at timestamptz, recorded_at timestamptz, PRIMARY KEY (payment_id, refund_id))`. Header
   with the rollback recipe. `src/schema.ts` mirrors it.
2. `src/stripe-webhook.ts`: the envelope reads optional `created`; `charge.refunded` requires it and
   its events carry `snapshotAt: Date`; `refund.failed`, `refund.updated`, `charge.refund.updated`
   read a Refund (`id`, `payment_intent`, `amount`, `currency`, `created`, `status`) into
   `{ type: "refund_failed", eventId, paymentId, refundId, amount, refundCreatedAt, failedAt }` for
   `failed` / `canceled` (`refund.failed` always), else `ignored`; no `payment_intent` → `ignored`;
   missing `created` → invalid.
3. `src/refund.ts`: `moveForwardByDays`; pure `getRestoredDays({ takenBackDays, refundedAmount,
   restoredAmount, amount, policy })`.
4. `src/server/take-back.ts`: `shiftLaterPeriods` takes a threshold and signed days (exported);
   `takeBackGrant` keeps its behaviour.
5. `src/server/payments.ts`: `refundPayment` accepts `observedAt?: Date` (default now), subtracts the
   failures the snapshot still counts, adds `days` to `taken_back_days` and sets `refunds_seen_at`
   when it applies a refund. New `failRefund(ctx, { provider, paymentId, refundId, amount,
   refundCreatedAt, failedAt })` → `unknown_payment` | `duplicate` | `refund_failed`. Webhook
   dispatch for `refund_failed`. Exported from `/server`.
6. `src/next/route.ts`: compiles with the new outcome (no special case).

**Tests:** parser: `refund.failed` / `refund.updated` failed / canceled / succeeded, without
`payment_intent`, without `created`, `charge.refunded` without `created`. Pure: `getRestoredDays`
(pro rata, last failure, keep_access, nothing refunded). PGlite: a full refund then its failure
(back to the original end, payment paid, period restored); a partial refund then its failure; two
partials, the second fails; the same failure twice; a failure of a refund never counted, then the
snapshot that counts it; a stale snapshot after the failure; a new refund after the failure; a
failed lifetime refund; a failure after another grant stacked (a grant at the end); a partial
failure with a later payment stacked (inverse insertion shifts it forward); `keep_access`; a payment
without a grant; an unknown payment; the end to end webhook with signed fixtures.

**Done when:**
- Automated: the failed refund tests pass on PGlite and in the pure suites; Gates green (typecheck, lint, test).

## Phase 2: Export, docs, e2e

**Discipline:** test-after. **Files:** `src/server/privacy.ts`, `tests/privacy.test.ts`,
`modules/billing/README.md`, `examples/next-app/e2e/migrations.spec.ts`,
`examples/next-app/e2e/billing-stripe.spec.ts`.

1. `src/server/privacy.ts`: the export lists the account's refund failures (`refundFailures`);
   erase relies on the cascade from payments.
2. README: §1 one line; §4 the webhook events (add `refund.failed`), the table rows, a "Failed
   refunds" paragraph; §5 the `0007` columns and table; §11 export; §12 the limitation becomes the
   remaining ones (rows before `0007` give back no days; a payment without a grant).
3. e2e: ledger line `billing 7 record_failed_refunds (applied)`; `stripeEvent` sends `created`.

**Done when:**
- Automated: `npm run e2e` passes `migrations.spec.ts` and `billing-stripe.spec.ts` locally; Gates green (typecheck, lint, test, build).

## Risks and rollback

- A failure restored wrongly gives access back without payment: low, the owner sees failed refunds
  in Stripe; covered by the ordering tests.
- Rollback: revert the branch; the migration's header drops the table and the two columns and
  deletes the ledger row.

## Decisions (auto)

- Complexity → medium (one migration, one new event, reuse of take-back).
- Accept `refund.updated` and `charge.refund.updated` beside `refund.failed` → yes (an endpoint may
  subscribe to either; the refund id deduplicates).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Failed refunds give back access

#### Automated
- [x] 1.1 Failed refund tests pass on PGlite and in the pure suites — e16b891 (the PGlite test file landed in c8163d3)
- [x] 1.2 Gates green (typecheck, lint, test) — e16b891

### Phase 2: Export, docs, e2e

#### Automated
- [x] 2.1 `npm run e2e` passes `migrations.spec.ts` and `billing-stripe.spec.ts` locally — c8163d3
- [x] 2.2 Gates green (typecheck, lint, test, build) — c8163d3
