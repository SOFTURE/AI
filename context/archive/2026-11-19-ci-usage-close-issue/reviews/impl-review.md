# Implementation review: ci-usage-close-issue

Reviewed: commits 3417564 and 391934e against plan.md. Mode: autonomous. Verdict: approve.

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Suggestion | With `close`, the issue intro ("kept up to date … every run adds a comment") reads as a rolling issue. | Kept: true of one issue's lifetime, and changing the message keys would break an app's own dictionary shape. |
| 2 | Suggestion | `set -u` with an empty `close` array needs bash 4.4 or later. | Holds: the step runs on the reusable workflow's runner (bash 5), like the Report step's `premium` array. |

Evidence: `vitest run tools/ci-usage tests/repo/ci-usage-workflow.test.ts` 101 tests green (new: close after the
comment with the exact PATCH body and request order, close of an updated issue, a refused close as a value, the CLI
`--close` line, the workflow input and the self caller); typecheck, ESLint and the language gate green in the
pre-commit hook. The default path makes no extra request (the existing request-order tests are unchanged).
