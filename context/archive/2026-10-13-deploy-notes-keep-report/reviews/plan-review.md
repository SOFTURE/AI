---
change_id: deploy-notes-keep-report
reviewed: 2026-10-13
verdict: approved
---

# Plan review: deploy-notes-keep-report

Checked plan.md against change.md, research.md, issue #436 and the files it touches.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | `inputs.keep-report` reaches the shell as the string `true`/`false`; compare exactly `true`, so an unexpected value means "off" (today's behaviour). | Taken into Phase 1. |
| 2 | Warning | `$(...)` would drop the kept part's trailing newlines; read the file with `read -d ''` instead. | Taken (research). |
| 3 | Check | Generated caller must still parse equal to the example (`generate.test.ts`): edit both together. | No change. |
| 4 | Check | bash 3.2: `[[ == *pat* ]]`, `${var#*pat}`, `read -d ''` are all available. | No change. |

No Critical findings.
