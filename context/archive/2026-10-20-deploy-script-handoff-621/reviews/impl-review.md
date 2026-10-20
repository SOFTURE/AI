---
change_id: deploy-script-handoff-621
reviewed: 2026-10-20
verdict: approved
---

# Implementation review: deploy-script-handoff-621

Checked the diff (2e00802, 82f74eb) against plan.md, change.md and issue #621.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The hand-off runs after every archive check and before the registry token, the files step or any step line; the parent prints only its stderr note and no result line (`reports_result=""`), so the workflow reads one set of lines, the shipped script's. | No change. |
| 2 | Check | A failure to copy the shipped script still ends with the parent's own `result|failed|archive|…`. | No change. |
| 3 | Check | The child is never handed off again (`HANDOFF_FROM` set) and keeps the inherited fd 9; the real-`flock` test shows the release finishes at once and frees the lock afterwards. | No change. |
| 4 | Minor | The real-`flock` test runs only where `flock` exists (not on stock macOS); the stubbed tests cover the rest there. | Kept: the lock is the kernel's, a stub cannot show it. |
| 5 | Check | `previous_tag`, `.env.prod`, cron lines and the installed script all resolve against the app folder in the child, pinned by the first test. | No change. |
| 6 | Check | A shipped script without the hand-off is deployed by the running copy as before, pinned by its own test. | No change. |
| 7 | Check | bash 3.2: no new construct beyond `cmp`, `grep -q` and a plain variable. | No change. |

No Critical or Major findings.
