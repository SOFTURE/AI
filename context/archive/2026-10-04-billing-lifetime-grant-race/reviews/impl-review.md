# Implementation review: billing-lifetime-grant-race

Reviewed: baac224 on `claude/project-thread-3ronhj` against plan.md and change.md. Mode: deep
(money and locks). Verdict: ready.
Findings: 0 critical, 0 warning, 2 suggestion (both accepted).

## Verdict

Every Done-when criterion is met and checked: gates green (typecheck, lint with the language gate,
2730 tests incl. the Postgres lock tests on a local Postgres 16 through
`SOFTURE_TEST_POSTGRES_URL`, build). Both new Postgres tests failed on `master` before the fix
(two `Ok` results; one lock waiter and a timeout) and pass three runs in a row after it.

## Dimensions

| Dimension | Result |
| --- | --- |
| Plan coverage | PASS: phase 1 complete; plan review W1, W2, S1 applied |
| Correctness | PASS: pin, then `lockEntitlementRow`, then the check; `applyPlan` updates the pinned row (no second insert) |
| Locks | PASS: order unchanged (account key share, entitlement, request or grant row); a second grant waits on the first's uncommitted insert, then on its row lock; no cycle with refunds, revokes or `changeEntitlement` |
| Data | PASS: no migration; the pinned row holds the derived trial, the same values reads compute |
| Failure paths | PASS: a `request_closed` refusal deletes only a row this transaction inserted; a database error rolls the pin back |
| Security | PASS: no new input; action guards untouched |
| Tests | PASS: two Postgres races (lifetime + lifetime, lifetime + period ordered by a request blocker), one PGlite refusal |
| Conventions | PASS: English only; options object for the pin's input; boolean return answers one question |
| Docs | PASS: header comments of `grants.ts` and `lockEntitlementRow` |

## Plan coverage

| Goal | Evidence |
| --- | --- |
| The second of two grants at once on a new row is refused | `tests/lock-races.test.ts` "refuses the second of two lifetime grants made at once on an account without a row", "refuses a period grant made while a lifetime grant is still open on an account without a row" |
| Every refusal writes nothing | `tests/grants.test.ts` "leaves no entitlement row behind when it refuses a grant on an account that had none"; existing request-closed tests on accounts with rows |

**Mutations (not committed):** dropping the pin fails both Postgres tests (master's behaviour);
dropping the delete after `request_closed` fails the PGlite test.

## Findings

### S1 [SUGGESTION] `startPayment` still checks lifetime without a lock
**Where:** `src/server/plans.ts:107-108`
**Decision:** Accepted as is (research F5): it only refuses early; paid money is recorded by
`recordPayment` whatever the record says, and a manual grant re-checks under the lock.

### S2 [SUGGESTION] The example app's e2e was not run locally
**Where:** `examples/next-app/e2e/billing-*.spec.ts`
**Decision:** Accepted: the grant's results and writes are unchanged for every non-racing call
(the pinned row equals the derived trial and `applyPlan` updates it); CI's e2e job runs the
manual grant and revoke flows on the PR.
