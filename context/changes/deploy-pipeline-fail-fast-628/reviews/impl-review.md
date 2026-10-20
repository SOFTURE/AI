---
change_id: deploy-pipeline-fail-fast-628
reviewed: 2026-10-20
verdict: approved
---

# Implementation review: deploy-pipeline-fail-fast-628

Checked the diff against plan.md, change.md and issue #628.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | The new SSH check runs before every send, the end-to-end path included: its known hosts line is `[127.0.0.1]:<port>` and its port comes from the same release value the send uses. | Matches `-F "[host]:port"`; no change. The e2e workflow exercises it on the next master run. |
| 2 | Minor | The check writes the key to disk; a failed step must not leave it. | Own `mktemp -d` folder removed by an EXIT trap; the cleanup step also runs `always()`. |
| 3 | Minor | `fail-fast` reaches `strategy` as an expression. | actionlint 1.7.12 accepts it over every deploy workflow and example. |
| 4 | Minor | bash 3.2 (macOS job): no associative arrays or GNU-only flags in the new scripts. | `mktemp -d <template>`, `${var:+set}`, `(( ))` only; ssh-keygen flags are the same on both. |
| 5 | Check | A caller that changes nothing: `build`, `fail-fast`, `preflight` default to today's behaviour; the only new behaviour on an unchanged caller is the SSH check before a send, which refuses only what the send would also fail on. | No change. |
| 6 | Check | No watcher needs `build`, `deploy` or `report`; only watchers hold `actions: write` (tests). | No change. |

No Critical findings.
