---
change_id: db-testing-pool-in-transaction-785
verdict: approved
---

# Plan review

- Coverage: the acceptance ("fails fast with a message naming the cause, or the README states the rule") is met
  twice: phase 1 test and phase 2 README. connections' doc ask has a step.
- Risk: a legit pattern flagged. Concurrent unrelated work has no scope; a fire-and-forget query that outlives the
  transaction sees `isOpen` false. A pool query awaited inside the callback is always a deadlock on PGlite, so no
  false positive there. The whole suite runs on the guarded helper; any regression shows. Accepted.
- Risk: PGlite internals calling the instance methods from inside a transaction (`sql` calls `this.query`, `listen`
  on the tx object calls `this.listen`). `listen` is not overridden; instance `sql` inside the scope is a deadlock
  anyway. Accepted.
- Risk: `reuse.ts` resets through `client.transaction`; the reset callback only uses `tx`. Covered by the reuse test.
