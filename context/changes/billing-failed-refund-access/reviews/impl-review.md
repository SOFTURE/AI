# Implementation review: billing-failed-refund-access

Reviewed: the branch diff (`migrations/0007_record_failed_refunds.sql`, `src/{schema,stripe-webhook,refund,index}.ts`,
`src/server/{payments,take-back,privacy,index}.ts`, the tests, README, the example's e2e and webhook
route comment) against plan.md and the plan review. Verdict: **approved**; one gap filed as FU-35.

## Plan conformance

| Step | Result |
| --- | --- |
| 1.1 Migration `0007` | `taken_back_days` (CHECK ≥ 0), `refunds_seen_at` (backfilled where something was refunded), `billing.refund_failures` with PK `(payment_id, refund_id)` and `ON DELETE CASCADE`; rollback recipe in the header; `schema.ts` mirrors it. |
| 1.2 Parser | Envelope `created` read; `charge.refunded` without it is invalid and carries `snapshotAt`; `refund.failed` always, `refund.updated` / `charge.refund.updated` with `failed` or `canceled` become `refund_failed`; other statuses and a refund without `payment_intent` are `ignored`; amounts in billing's unit. |
| 1.3 Pure rules | `moveForwardByDays`, `getRestoredDays` (pro rata share rounded down, the rest on the last failure, everything under `keep_access`), `getGrantStart` shared with `getPaymentGrant`. |
| 1.4 Shift | `shiftLaterPeriods` takes a threshold and a direction; `takeBackGrant` unchanged in behaviour (the existing partial and full refund suites pass). |
| 1.5 `refundPayment` / `failRefund` | Correction by the failures a snapshot still counts; `refunds_seen_at` kept at its maximum; `taken_back_days` grows by the days taken (plan review F2: 0 when nothing dated was left). `failRefund` takes the same locks, records the failure first (duplicate on conflict), restores only what billing counted. Plan review F1 is in the `observedAt` doc comment. |
| 1.6 Route | Compiles unchanged: a `refund_failed` outcome answers 200. |
| 2.1 Export | `refundFailures` (provider payment id, refund id, amount, both times), oldest first; the erase removes them through the cascade (tested). |
| 2.2 README | §1, §4 (events to subscribe, table rows, "Failed refunds"), §5 (columns, `0007`), §11, §12 (the FU-30 limitation replaced by the rounding and pre-`0007` notes, plus FU-35). |
| 2.3 e2e | Ledger line `billing 7 record_failed_refunds (applied)`; the e2e's Stripe events carry `created`; `migrations.spec.ts` and `billing-stripe.spec.ts` pass on Postgres 16. Plan review F3: no unit test lists the ledger. |

## Checks

| Check | Result |
| --- | --- |
| Correctness | 15 PGlite cases: full and partial failures, a share with another refund standing, a repeat, a never-counted failure and the late snapshot that counts it, a refund created after the newest snapshot, a stale snapshot after a failure, a new refund after it, a payment stacked after a full refund (days at the end), a payment stacked after a partial one (moved forward again), a payment without a grant, an unknown payment, lifetime, `keep_access`, the signed webhook end to end, export and erase. |
| Money invariants | Every restore writes `status = 'paid'` with `refunded_amount < amount` (it only runs when it restores more than 0), so `payments_refunded_amount_by_status` and `payments_refunded_at_with_status` hold. |
| Locks | Account (key share) → entitlement → payment row, as every take-back; the forward shift runs under the entitlement lock. |
| Errors | Database errors propagate (500, Stripe retries); impossible states throw with the operation named, like `takeBackGrant`. |
| Language | English only; `npm run lint:language` green. |
| Gates | `npm run typecheck`, `npm run lint`, `npm test` (2678 passed), `npm run build` green. |

## Findings

- R1 (gap, filed as **FU-35**): a newer `charge.refunded` whose total is lower than the recorded one
  (an earlier refund failed, billing has not heard yet, and a new refund was made) is `duplicate`;
  when the failure then arrives it gives back the earlier refund, and the new refund is never taken
  back. Needs the failure delivered after a later refund's own event; README §12 states it.
- R2 (accepted): no two-connection race test for `failRefund` against `refundPayment`; both take the
  same locks in the same order as the refund and revoke paths FU-26 tested, and the failure row's
  primary key decides a concurrent repeat.
