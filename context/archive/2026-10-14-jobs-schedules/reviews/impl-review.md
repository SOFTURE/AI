# Implementation review: jobs-schedules

Reviewed: the branch against plan.md @ 2026-10-14. Verdict: ready.
Findings: 0 critical, 1 warning (fixed), 1 note.

## Lenses
| Lens | Result |
| --- | --- |
| Plan conformance | PASS: P1 schedules, enqueue once per period, success recording, `getQueueStats.schedule`; P2 `./jobs` entries in the five packages; P3 READMEs and CHANGELOGs |
| Correctness | PASS: the conditional upsert and the enqueue share a transaction; the success update shares the completion's transaction, so a failed write records neither |
| Tests | PASS: once per period across runners, a lagging clock, catch-up, coalescing with a live run, lateness, manual runs, the worker path, option validation; each package's handler runs its prune end to end through `runDueJobs` |
| Language and docs | PASS: English only; migration steps in each CHANGELOG |

## Findings
- WARNING (fixed): an optional peer range `^0.1.0` could not be installed while jobs was the unreleased workspace
  `0.0.0`. Resolved by merging master once jobs 0.1.0 was released (4117981): the peers take `^0.1.0` and
  `dependsOn` takes `jobs: "^0.1.0?"`; the schedules entry of the jobs CHANGELOG moved back under `## Unreleased`.
- NOTE: a schedule removed from the config keeps its `jobs.schedules` row; it is ignored and harmless.

## Decisions (auto)
- Peer range and `dependsOn` as above. The five packages and the next jobs version release together.
