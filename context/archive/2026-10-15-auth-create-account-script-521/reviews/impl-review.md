---
change_id: auth-create-account-script-521
reviewed: 2026-10-15
verdict: approved
---

# Implementation review: auth-create-account-script-521

Checked the diff against plan.md, issue #521 and the conventions in AGENTS.md.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The email never reaches a report or a refusal; the CLI test asserts the printed lines carry neither email nor hash. | No change. |
| 2 | Check | The lock is taken inside `executeOpsScript`'s transaction and released by its commit or rollback, dry runs included. | No change. |
| 3 | Check | `set-temporary-password` keeps its behaviour through the shared helper; its 16 tests pass unchanged. | No change. |
| 4 | Suggestion | `maxAccounts` could also bound registration. | Left out by decision (change.md); listed under the README's known gaps. |

No Critical or Warning findings.
