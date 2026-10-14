# Implementation review: jobs-schedules

Reviewed: the branch against plan.md @ 2026-10-14. Verdict: ready.
Findings: 0 critical, 1 warning (fixed), 2 notes.

## Lenses
| Lens | Result |
| --- | --- |
| Plan conformance | PASS: P1 schedules, enqueue once per period, success recording, `getQueueStats.schedule`; P2 `./jobs` entries in the five packages; P3 READMEs and CHANGELOGs |
| Correctness | PASS: the conditional upsert and the enqueue share a transaction; the success update shares the completion's transaction, so a failed write records neither |
| Tests | PASS: once per period across runners, a lagging clock, catch-up, coalescing with a live run, lateness, manual runs, the worker path, option validation; each package's handler runs its prune end to end through `runDueJobs` |
| Language and docs | PASS: English only; migration steps in each CHANGELOG |

## Findings
- WARNING (fixed): an optional peer range `^0.1.0` cannot be installed while jobs is the unreleased workspace
  `0.0.0` (`npm install` looks for it on the registry and the lockfile cannot be written). The peers take
  `^0.1.0 || 0.0.0`, and `dependsOn` takes `jobs: "*?"`, since the module manifest ranges cannot express "0.1 or the
  unreleased workspace version" and a jobs module of any version runs the handlers.
- NOTE: jobs must be released (0.1.0) before or with the five packages that now name it as a peer; their own
  release changes nothing for an app without jobs.
- NOTE: a schedule removed from the config keeps its `jobs.schedules` row; it is ignored and harmless.

## Decisions (auto)
- Peer range and `dependsOn` as above; narrowing the peer to `^0.1.0` can ride a later change once jobs is published.
