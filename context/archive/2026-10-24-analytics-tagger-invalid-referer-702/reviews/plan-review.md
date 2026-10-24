---
change_id: analytics-tagger-invalid-referer-702
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and `src/proxy/index.ts` on master (5b619cb).

- Correctness: the early return keeps the order of checks (`channel`, then `isTarget`), so the predicate is still not
  called for an untagged request. For a parsable Referer `source` is the same as before in both branches.
- Tests: the failing case from the issue, with and without targets, plus the rename path with a bad Referer.
- Compatibility: a bug fix only; no API change.

Verdict: approved, no changes.
