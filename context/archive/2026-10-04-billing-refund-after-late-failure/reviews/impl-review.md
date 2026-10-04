# Implementation review: billing-refund-after-late-failure

Reviewed: b7428e7 on `claude/project-thread-m9szln` against plan.md and change.md. Mode: standard
(access follows refunds, no money moves). Verdict: ready.
Findings: 0 critical, 0 warning, 3 suggestion (all accepted).

## Verdict

Every Done-when criterion is met and checked: gates green (typecheck, lint with the language gate,
the full test suite against a local Postgres 16, build). Seven of the eight new tests failed on
`master` (nothing kept, the new refund never taken back; the CHECK test on the missing columns);
the eighth (a full refund applied after a failure billing did not count) guards FU-30 behaviour.

## Dimensions

| Dimension | Result |
| --- | --- |
| Plan coverage | PASS: phase 1 complete; plan review W1 (README §4 row, `duplicate`) and W2 (§12 note) applied |
| Correctness | PASS: `applyChargeState` is `refundPayment`'s former body unchanged (correction, compare, update, `takeBackGrant`, stored period); `keepNewerChargeState` keeps a state only when newer than `refunds_seen_at` and the kept one; `failRefund` re-reads the row after its restore and applies the kept state |
| Concurrency | PASS: the keep and the apply run under the locks both functions already take (account key share → entitlement → payment row `FOR UPDATE`); no new lock |
| Data | PASS: `0009` adds two nullable columns and a shape CHECK (both NULL, or a non-negative amount with a time); rows from before keep nothing; rollback in the header |
| Failure paths | PASS: a kept state no failure explains stays and never applies on its own; repeated failures are `duplicate` before anything is read |
| Security | PASS: no new input; the signature check and parsing are unchanged |
| Tests | PASS: eight new PGlite tests (partial, full, equal-total, two failures, newest-only and superseded, repeated or older deliveries, CHECK shape, signed webhook deliveries in the late order) |
| Conventions | PASS: English only; functions named by what they do; options objects past three inputs |
| Docs | PASS: README §4 table row, "Failed refunds", column table, migrations list, §12; header comments of `payments.ts`, `refundPayment`, `failRefund`; schema header |

## Plan coverage

| Goal | Evidence |
| --- | --- |
| A newer lower state is kept and applied by the late failure, once | `tests/failed-refunds.test.ts` "keeps the newer, lower charge state, and takes the new refund back once the failure arrives" |
| After a full refund, and with an equal total | "takes the new refund back after a full refund failed", "takes the new refund back when it equals the failed one" |
| Waits through several failures; a newer applied state clears it | "waits for every failure the newer state left out", "keeps only the newest unapplied state, and forgets it once a later state is applied" |
| FU-30 behaviour holds | the FU-30 tests in the same file pass unchanged; "keeps nothing from a repeated or older delivery" |
| Signed fixtures | "take back a new refund reported before an earlier refund's late failure" (`charge.refunded` ×2, `refund.failed`) |

**Mutations (not committed):** dropping the apply in `failRefund` fails five tests; dropping the
keep in `refundPayment` fails six.

## Findings

### S1 [SUGGESTION] Days counted at the failure's delivery
**Where:** `src/server/payments.ts` (`applyKeptChargeState`)
**Decision:** Accepted and documented in README §12 (plan review W2): it matches a late
`charge.refunded` delivery.

### S2 [SUGGESTION] The kept state is not exported
**Where:** `src/server/privacy.ts`
**Decision:** Accepted as is: like `refunds_seen_at` and `taken_back_days` it is bookkeeping of
Stripe's own record; the refunded total a person can read is exported.

### S3 [SUGGESTION] The example app's e2e was not run locally
**Where:** `examples/next-app/e2e/migrations.spec.ts`
**Decision:** Accepted: the ledger line follows the migration file's name; CI's e2e job runs it on the PR.
