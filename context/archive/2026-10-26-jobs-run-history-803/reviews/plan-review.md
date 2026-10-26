---
change_id: jobs-run-history-803
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and issue #803.

- Scope: covers the four asks (summary, origin, separate retention, read plus admin page). Nothing beyond them.
- Data: the runs row is written in the same fenced transaction as the outcome, so a stale worker writes no run; the
  lease-expiry path is covered too, so every terminal failure appears in the history. No payload is copied.
- Compatibility: `origin` has a default in the migration and in code; `runs` on `JobsPanel` and `toJobsPanelData` is
  optional; `Completion.summary` is optional. Adding `origin` to `Job` is additive for readers. An app with its own
  full dictionary for another locale must add `runs` copy: the CHANGELOG must say so.
- Risks: `ClaimedJob.job.updatedAt` as the start relies on `claimJobs` setting it; keep a comment there. The summary
  check must not let a large object through: the strict schema and the 50-step cap bound it.
- Tests: written first for each phase; the hang-free PGlite setup in `tests/support.ts` is reused.

Verdict: approved.
