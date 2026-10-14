# Plan review: jobs-schedules

Reviewed: plan.md @ 2026-10-14. Mode: full. Verdict: ready.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: `enqueueJob` dedup semantics, `completeJob`, `getQueueStats`, the worker loop and `runDueJobs` checked in
`modules/jobs/src`; the optional-peer pattern checked in `modules/auth` (`./mailing`, `mailing: "^0.2.0?"`) and the
`dependsOn` rule in `tests/repo/packages.test.ts`; `onConflictDoUpdate({ setWhere })` exists in drizzle-orm 0.45.

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS: ask 1 → P1 (schedules, once per slot), ask 2 → P2, ask 3 → P1 (`getQueueStats`), ask 4 → P3 |
| Grounding | PASS |
| Scope | PASS: billing stays with #490 |
| Risk | WARN (below) |
| Testability | PASS |

## Findings
- WARNING: a worker that enqueues for a schedule whose queue it has no handler for would leave a job nobody claims
  when queues are split across workers; enqueue only for the worker's own queues. Accepted into Phase 1.
- SUGGESTION: record success for any succeeded job of a scheduled queue (a manual run counts), not only for jobs
  with the `schedule` key. Accepted into Phase 1.

## Decisions (auto)
- Folded into Phase 1; no re-plan.
