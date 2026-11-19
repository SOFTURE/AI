# Plan review: backup-verify-live-release

Verdict: **approved** (auto, autonomous mode).

- Scope matches `change.md` and both asks of #1386; the template addition is the same defect in a sibling file and
  is recorded as a decision.
- Evidence is agent-runnable: shell of the new steps runs against fakes in Vitest, no manual check left.
- Risk: the shared shell of the issue steps is duplicated in two files; acceptable for copy-me workflows that an app
  owns after copying, and both are tested.
- Shell constraints (bash 3.2, no GNU-only flags) apply to the new steps; the test runs them with `bash`.
