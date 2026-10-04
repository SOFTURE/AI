# Plan review: billing-failed-refund-access

Reviewed: plan.md and research.md against `src/stripe-webhook.ts`, `src/refund.ts`,
`src/entitlement.ts`, `src/server/{payments,take-back,privacy}.ts`, migration `0005` and README §4,
§12. Verdict: **approved** with three findings folded into the plan's steps (none blocking).

## Checks

| Check | Result |
| --- | --- |
| Outcome covered | Yes: phase 1 restores amount, status, lifetime and days; the ordering cases (repeat, never counted, stale snapshot, new refund after) each have a named test. |
| Idempotency | A database constraint (PK `(payment_id, refund_id)`) decides a repeated failure, under the payment row lock; the charge path keeps its "not above the stored total" rule, now on the corrected total. |
| Lock order | Unchanged: account (key share) → `lockEntitlementRow` → payment row; the failure row is inserted after them, the forward shift updates other rows under the entitlement lock like the take-back. |
| Money CHECK (`0005`) | A restore writes `refunded_amount < amount` with `status = 'paid'`, or keeps `refunded` when nothing below the amount remains (a free checkout: `amount = 0`). |
| Entitlement events | `grant { until }` needs `until > now` and never shortens: both restore paths extend past `max(paid_until, now)` by at least one day; a restore of zero days sends no event. |
| Policy | `keep_access` partials take 0 days, so "all once below the amount" restores only what the completing refund took. |
| Data safety | Forward-only columns with defaults, a new table, a backfill that only reads the row itself; rollback recipe in the header; the e2e ledger reads the real row. |
| Scope | No FU-32/33/34 work, no Stripe API call, no admin copy. |
| Language | English only. |

## Findings

- F1 (minor, into step 5): `refundPayment` called without `observedAt` (tests, a host's own
  refund handling) uses `now`; then no failure can be "after" it, so no correction applies and the
  call behaves as before. State it in the doc comment.
- F2 (minor, into step 5): a full refund whose take-back found no dated access (`paid_until` NULL)
  returns `days = 0`; record 0, so its failure restores the status and amount only. Do not count the
  period's unused days instead.
- F3 (minor, into phase 1 tests): `tests/setup.test.ts` or another ledger check may list billing's
  migrations; update it with `0007` rather than loosening it.
- Rounding note (accepted): under `pro_rata`, a failed completing refund gives back its money's share
  of every day taken, which can differ by a day from what that refund alone took; all failures
  together give back exactly the days taken. README states it.
