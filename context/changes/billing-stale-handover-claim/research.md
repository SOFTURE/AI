# Research: billing-stale-handover-claim

Input: change.md. Code read on `master` d36276f.

## Findings

### F1. `handed_over_at` means both "being handed over" and "handed over"
`claimHandOver` (`modules/billing/src/server/requests.ts:82-90`) sets `handed_over_at = now` only
where it is NULL; `releaseHandOver` (`:96-101`) clears it on an `Err` or a throw
(`src/server/plans.ts:124-136`). Success writes nothing, so after an `Ok` the column holds the claim
time. A claim left by a dead process and a finished hand-over look the same row for row.

### F2. A timeout on the one column alone would repeat every finished hand-over
If a claim older than N seconds counted as free, every request handed over successfully would be
handed over again on any ask after N seconds, the opposite of "the owner hears of it once"
(README §3, `tests/payments.test.ts` "hands an open request over once"). So the timeout needs a
second state: a confirmed hand-over.

### F3. A confirmation flag alone (no timeout) would lose the concurrency guard
The item's second option ("set only after `onRequest` answers `Ok`, two writes, no timeout"): if a
claim does not block a second claim, two asks at once both hand over (the guard FU-27 added,
`tests/payments.test.ts` "hands over once when two asks run at once"); if it does block, a claim
left behind blocks forever (today's gap). So both are needed: a confirmed hand-over that never
expires, and a claim that blocks others only for a bounded time.

### F4. Nothing else reads the column
`grep handedOver|handed_over` over `modules/`, `examples/` and `ops/`: `schema.ts:62`,
`requests.ts`, the migration `0006` and the README. The admin page, the privacy export and expiry
do not read it. Closing a request (`getClosedRequestColumns`) does not touch it.

### F5. How long a claim may stand
`onRequest` is the app's mail or ticket call (`src/manual.ts:23`); the example app sends one mail.
A mail provider answers in seconds; one minute leaves an order of magnitude of margin. A claim
that outlives a live hand-over lets a concurrent ask hand over a second time (the owner gets two
mails), which is the lesser failure next to no mail. An ask made within the minute after a crash
still answers "requested" without a hand-over; the next ask after it hands over.

### F6. Mailing twice
When the first hand-over did send its mail and the process died before the confirm write, the
retry mails again. Billing cannot tell (the provider's side effect is outside its transaction), so
the hand-over is at least once after a crash, exactly once otherwise. The admin page lists one
request either way (one open row per account and plan).

### F7. Migrations
The last billing migration is `0007_record_failed_refunds.sql`; FU-33 added none. The example
app's `e2e/migrations.spec.ts:19` lists every applied migration, so `0008` adds a line there.

## Recommendation

Two columns: `handed_over_at` keeps "the hand-over succeeded" (written after `Ok`), a new
`handover_claimed_at` holds the claim. A claim takes the row when it is not handed over and has
no claim or a claim at least one minute old; success sets `handed_over_at` and clears the claim;
failure clears only its own claim. Rows from before keep `handed_over_at` (they count as handed
over; a claim left behind before `0008` cannot be told apart).
