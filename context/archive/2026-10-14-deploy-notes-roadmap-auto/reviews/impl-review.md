---
change_id: deploy-notes-roadmap-auto
reviewed: 2026-10-14
verdict: approved
---

# Implementation review: deploy-notes-roadmap-auto

Reviewed: the branch diff against plan.md, change.md and issue #465.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance: only an archived roadmap closed since the previous tag lists its `done_code` rows; neither gives no table and exit 0; an explicit missing path still fails (existing test). | No change. |
| 2 | Check | Plan review 1 and 2: the directory follows `--`; `git show <ref>:./<path>` and `diff --relative` keep paths relative to `cwd`; refs pass `assertSafeRef`. | No change. |
| 3 | Check | Archived roadmaps are read at `--to`: a later edit of the file does not change a redeploy's table (tested with `ZZ-1`). | No change. |
| 4 | Warning | The main roadmap is read from the working tree, archived ones from `--to`. In a release job the checkout is `--to`, so both agree; a local run on another checkout may differ. | Accepted (change.md decision). |
| 5 | Warning | `--no-renames` makes a roadmap moved from `roadmap.md` into the archive count as added, which is the case the issue describes. | No change. |
| 6 | Check | Docs: README release-notes section and usage, CLI usage text, CHANGELOG `## Unreleased` (no bump, batched releases). No workflow template in this repository passes `--roadmap`. | No change. |

Gates: see plan.md Progress.
