---
change_id: quality-review-focus-scope-1289
verdict: approved
---

# Plan review (auto)

- Scope matches #1289 point by point: `focus` with a shipped security prompt and eight rules, `paths`, `scope` by
  folder or package name, report-only-inside filter written once, scope context in the prompt, header rows, per-scope
  report path, ignore file and branch, workflow inputs, README examples, cost line, tests per acceptance item.
- Risk: the general output drifting. Mitigated by a test that compares the general system prompt and task with the
  0.1.1 text and a report without new rows.
- Risk: path traversal through `scope`. The folder is resolved with realpath and must stay inside the repository; the
  agent's read guards are unchanged (it may still read the whole repository, as the issue asks).
- Risk: workflow branch input change. Default empty resolves to `quality-review` for a general unscoped run, so
  existing callers keep their branch.
- Approved.
