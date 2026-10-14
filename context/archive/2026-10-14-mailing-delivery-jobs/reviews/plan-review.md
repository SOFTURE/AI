# Plan review: mailing-delivery-jobs

Reviewed: plan.md @ 2026-10-14. Mode: full. Verdict: ready.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: `deliverOnce`, `sendMail`'s `readOutcome`, `resend()`'s `readOutcome`, `enqueueJob`, `defineJobHandler`,
`failJob`, `retryJobLater`, `runDueJobs` and billing's optional `./mailing` peer exist as named; the release rule that
a range must accept the workspace version is in `scripts/release/release-rules.mjs`.

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: ask 1 → P2 (handler, enqueue, mapping) and P1 (Retry-After); ask 2 → handler keeps `deliverOnce`; ask 3 → decided in Approach; ask 4 → P3 |
| Grounding | PASS |
| Scope | PASS: auth and waitlist stay with #494, `modules/jobs/` with #491 |
| Risk | WARN (below) |
| Testability | PASS |

## Findings
- WARNING: `@softure-ai/jobs` is 0.0.0 in the workspace and will be first published as 0.1.0. A peer range of
  `^0.1.0` would fail the release rule now; `^0.0.0` would refuse the published 0.1.0. Use `^0.0.0 || ^0.1.0` in
  `package.json` and `*?` in `dependsOn` (the core range syntax has no `||`), and note in the CHANGELOG that the
  release narrows nothing. Accepted into Phase 2.
- SUGGESTION: the handler holds no claim across attempts, so a job that fails for good leaves the ledger row
  `pending`; say in the README that `retryJob` (jobs) resends it and that the ledger never sends twice. Accepted into
  Phase 3.

## Decisions (auto)
- Id-only payloads with `buildMail` at run time (serves #494; keeps personal data out of `jobs.jobs`).
- `provider_refused` retries with the queue's backoff like `quota_exceeded`: the account may be fixed while the job
  waits; the job fails after `maxAttempts` and `retryJob` sends it again.
- `buildMail` returning `null` ends the job as `succeeded` (nothing left to send, e.g. the token was used).
