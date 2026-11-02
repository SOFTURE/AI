---
change_id: jobs-db-outage-logs-933
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (2f4bddb).

- Scope covers the issue: every database call of the loop named in the issue (schedule enqueue, schedule check,
  prune, lease extension, outcome recording, claims) plus the release on stop, which fails the same way when Postgres
  is gone before SIGTERM. The optional "stop the round after the first failure" is taken: it is what cuts 21 lines to 1.
- Constraint kept: failures that are not an outage keep their `error` line; `databaseOutageToleranceMs: 0` restores
  the old levels for an app that wants them.
- Risk: a misclassified error hidden as `info`. Mitigated by a closed list of codes and messages, unit-tested for both
  sides, and by the tolerance: after one minute every line is `error` again.
- Risk: the outage never ends in the counters when no database call succeeds again before stop; harmless, the
  process exits.
- Overlap with #934 (`src/server/process.ts`): none in code; README/CHANGELOG may conflict at merge, resolved then.
- Proof: unit tests for the classifier, worker tests on PGlite with a failing database handle.

Verdict: approved, no changes.
