# Implementation review: billing-partial-refunds

Scope: full · Date: 2026-10-04 · Commits: 34fca67..HEAD (d8c0936, 5aa5c34, review fix) · Gates: typecheck ✓ lint ✓ test ✓ (billing and repo suites, 496 tests) · build ✓ · e2e ✓ (91 passed, `npm run e2e` against local Postgres 16)

## Verdict

Ready. Both phases deliver the plan: a cumulative refunded amount per payment, a pure share rule on
the existing take-back path, the `partialRefunds` option with a documented default, and the history,
export and docs. One comment wrap was fixed; one behaviour (failed refunds) is filed as FU-30.

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | ✓ | - |
| Progress honesty | ✓ | - |
| Correctness | ✓ | F2 |
| Tests | ✓ | - |
| Migrations | ✓ | - |
| Security | ✓ | - |
| Patterns and lessons | ✓ after fix | F1 |
| Documentation | ✓ | - |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1 Partial refunds take back access | d8c0936 | migration `0005_record_refunded_amounts`, `partialRefunds` option, `getTakenBackDays`/`isFullShare`/`getRefundEvent(record, grant, timing)`, `payment_partially_refunded` webhook event, `refundPayment({ amountRefunded })`, `takeBackGrant` returns `{ entitlement, days }`, outcome `partially_refunded` | as planned, plan review W1-W3 applied |
| 2 Admin history, export, docs, e2e ledger | 5aa5c34 | history `refundedAmount` and "Paid, {amount} refunded" (`en`, `pl`), export `refundedAmount`, README §1/§3/§4/§5/§11/§12, ledger line, FU-30 filed | as planned |

## Evidence

- Sum equals one full refund: `tests/partial-refunds.test.ts` "add up to what one full refund at the
  time of the last one takes back, across the DST change" compares a three-step series (9, 7, then 4
  days, crossing 25 October) with another account's single full refund: same `paid_until` and the
  same resolved entitlement.
- Idempotency: the same total twice and a smaller total delivered late are `duplicate`, with the
  stored amount and period unchanged; a partial after a full refund is `duplicate`.
- Policy: `keep_access` takes nothing on a partial refund and every unused day on the completing one.
- Lifetime and old rows: a partial refund keeps lifetime and does not revoke a row without a grant;
  the completing refund ends or revokes.
- Stacked periods: a partial refund of the first month moves the second month's stored dates; a later
  full refund of the second takes back exactly its 30 days.
- No dated end left: the stored period is untouched (plan review W1).
- Database: CHECK `payments_refunded_amount_by_status` refuses an amount above the payment's, a paid
  row refunded in full, a negative amount, and a refunded row with less (PGlite).
- Webhook: signed fixtures through `receiveStripeWebhook`; the e2e's full refund without
  `amount_refunded` still parses (`tests/stripe-webhook.test.ts`).

## Findings

### F1 [fixed] A header comment in `payments.ts` was wrapped mid-sentence
**Where:** `modules/billing/src/server/payments.ts:1-5`. The edit left a short line in the module
header. Rewrapped in the review fix commit.

### F2 [accepted] A failed refund keeps the days taken
**Where:** `refundPayment`, README §12. A refund Stripe later fails lowers `amount_refunded`; billing
treats the lower total as stale and keeps the payment's state. The full-refund path had the same
behaviour before this change. Filed as FU-30 (`billing-failed-refund-access`), lane C after FU-27.

## Lessons

L-001 and L-002 unaffected (no new package entry, no Next import). No new lesson.
