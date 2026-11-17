---
change_id: quality-review-security-coverage-1325
verdict: approved
---

# Implementation review

Reviewed the diff 230d3ca..7fbdc4a against plan.md and change.md.

- Drift: none. The three phases match the plan; the prompt's coverage step moved from Phase 3 to Phase 1 (recorded
  under Decisions).
- Single cost cap: a security run makes one `query()` call with a streamed prompt; cost and model usage are read from
  the latest result (cumulative per the SDK), turns are summed per user turn. No `resume`.
- Hang risk: the prompt stream is closed after every result that needs no follow-up, and in `finally`; the failure
  path is tested (`closes the prompt stream when the agent fails`).
- Evidence honesty: coverage files are kept only when the agent read them with Read and they exist as files inside
  the repository (realpath and the given path both accepted); a traced scenario with none left is `not covered`.
- General run: still a string prompt, the 0.1 task and a report without the new rows (tested in
  `tests/coverage-run.test.ts` and the unchanged `tests/focus-scope.test.ts` word-for-word test).
- Format: `check` reads `Turns`, `Files read` and `## Coverage` back; an edited table names each problem. A report
  with a coverage section is refused by an older `check`; the CHANGELOG says so and the workflow pins one version.
- Tests: exact values, failure and boundary cases (follow-up limit, budget stop, unread files, outside paths).

Verdict: approved, no findings.
