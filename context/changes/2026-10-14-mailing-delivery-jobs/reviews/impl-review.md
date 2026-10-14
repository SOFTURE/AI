# Implementation review: mailing-delivery-jobs

Reviewed: commits 14a9004..8243d6a against plan.md. Mode: full. Verdict: ready.
Findings: 0 critical, 1 warning (fixed), 2 notes.

## Coverage
| Ask of #492 | Where |
| --- | --- |
| a jobs handler and `enqueueDelivery`, enqueued in the app's transaction | `modules/mailing/src/jobs/delivery-job.ts`; tests: commit, rollback, duplicate scope, due time |
| `unavailable` / `quota_exceeded` retried with the provider's `Retry-After` | `resend.ts` `readRetryAfter`, `send-mail.ts`, `deliveries.ts`; `getDeliveryJobResult`; tests per outcome |
| `rejected` / `suppressed` / `invalid_input` fail the job | `failJob(reason)`; tests: provider rejection, invalid address, mapping table |
| the ledger stays the at-most-once guard | the handler calls `deliverOnce`; tests: a retried job sends once, a closed ledger row sends nothing |
| the ledger's attempt counting for callers without jobs; optional peer | `maxAttempts: null` only inside the handler; `peerDependenciesMeta.optional`; test: more unavailable answers than the ledger's limit still end in a send |
| README and CHANGELOG with a migration | README "Deliveries through jobs"; CHANGELOG Unreleased, four migration steps |

## Adversarial read
- WARNING (fixed): an `in-flight` retry exactly `staleClaimMs` later meets a claim that is not yet stale (`lt`), so it
  would wait a second window. The delay is now one second past the window; the test asserts it.
- `buildMail` runs before the claim, also when the ledger is closed; the README requires it to be side-effect free and
  deterministic, and explains token links (answer given to the #494 thread).
- No address, body or token in `jobs.jobs`: the test asserts the stored payload does not contain the address.
- `provider_refused` and `quota_exceeded` use up job attempts (the ledger gives its attempt back); a job that fails for
  good leaves the ledger `pending`, and `retryJob` resends it. Documented.

## Notes
- A provider's `Retry-After` is not capped; Resend sends short values. A cap can follow if an adapter misbehaves.
- The peer range `^0.0.0 || ^0.1.0` accepts the unreleased workspace version and the first published jobs version.
