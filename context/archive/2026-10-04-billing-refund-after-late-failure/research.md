# Research: billing-refund-after-late-failure

Input: change.md. Code read on `master` 0123ea2.

## Findings

### F1. How the gap happens
`refundPayment` (`modules/billing/src/server/payments.ts`) corrects the reported total by the failed
refunds the snapshot still counts (`getFailedAmountCounted`: created by `observedAt`, failed after
it), then returns `duplicate` when the total is not above `refunded_amount` (and always when the
payment is `refunded`). Sequence: refund A (1000) recorded at t1 (`refunds_seen_at` = t1); A fails at
t3 but `refund.failed` is delayed; refund B (900) at t4 sends `charge.refunded` with
`amount_refunded` 900. Billing knows no failure, so 900 <= 1000 is `duplicate` and nothing is kept.
The late failure of A is counted (t1 <= t1 < t3) and gives back 1000: `refunded_amount` 0, B lost.
The same holds when A was a full refund (status `refunded`), and when B equals A (900 = 900).

### F2. Re-reading the charge from Stripe is not available
Billing has no Stripe API client: `stripe()` builds Checkout sessions through the app's adapter, and
the webhook path only verifies and parses (`src/stripe-webhook.ts`). A re-read inside `failRefund`
would add a network call inside a transaction holding the entitlement lock, a secret on the
webhook path and a new failure mode (Stripe down = 500 and retries). Storing the state is local.

### F3. Storing the newest unapplied state is enough
A charge state is Stripe's cumulative `amount_refunded` at the event's `created`. Corrected by the
failures billing knows at the time it is read (`getFailedAmountCounted` at that state's time), it
is the true total at that time. So billing can keep the newest state it did not apply (raw amount
and time) and re-read it whenever a failure is recorded: if, corrected, it is above what billing
now counts, it is applied like a delivery at that time. Failures that arrive later only lower the
corrected value, so keeping the raw amount is right; correcting at storage time would not be.

### F4. Which states to keep
Only a state newer than the newest applied one (`refunds_seen_at`) can carry a refund billing has
not counted. A repeated delivery has the same `created` (Stripe keeps it on retries) and is not
newer. Among unapplied states only the newest matters (Stripe's total is cumulative). A state that
equals the recorded total must be kept too (B = A in F1). A newer state that is applied supersedes
a kept one at or before its time.

### F5. Running the take-back inside `failRefund`
`failRefund` already holds the account (key share), the entitlement row and the payment row, the
lock order of `refundPayment`. Applying a state is `refundPayment`'s body after its locks (correct,
compare, update the payment, `takeBackGrant`, shorten the stored period). Extracting that body into
one function that both call keeps one code path and the same locks; `failRefund` calls it after its
own restore, on the payment row re-read in the transaction.

### F6. Columns and migrations
The last billing migration is `0008_record_request_handover_claims.sql`. The privacy export lists
payment columns a person can read (`refunded_amount`, grants); `taken_back_days` and
`refunds_seen_at` are bookkeeping and not exported, so the new columns follow them. The example
app's `e2e/migrations.spec.ts` lists every migration; `0009` adds a line.

## Recommendation

Migration `0009` adds `pending_refunded_amount` and `pending_refunds_seen_at` to `billing.payments`
(both NULL or both set). `refundPayment` keeps a newer state it does not apply there; applying a
state at or after the kept one clears it. `failRefund`, after its restore, applies the kept state
through the shared function when its corrected total is above the recorded one.
