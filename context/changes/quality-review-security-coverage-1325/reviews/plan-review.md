---
change_id: quality-review-security-coverage-1325
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (b421f84).

- Both suggestions of #1325 are covered: evidence in the report (Phase 1, 2) and the minimum coverage step (Phase 2).
- The single hard cap holds: the follow-up runs in the same `query()` call (streaming input), whose budget and cost
  are cumulative; `resume` was rejected for that reason.
- Contract between phases: Phase 1 defines `SECURITY_SCENARIOS` and the coverage types; Phase 2 only consumes them;
  Phase 3's prompt test checks the prompt names every entry of the same list, so the list cannot drift.
- Risk: the input stream must be closed on every path, or the iteration hangs. Phase 2 tests the error path.
- Risk: older `check` versions refuse the new `## Coverage` section; the workflow pins one CLI version for run and
  check, and the CHANGELOG says so.
- No overlap with #1324's files (workflow, `cli/command.ts`, branch-name tests).

Verdict: approved, no changes.
