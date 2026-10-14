---
change_id: deploy-notes-roadmap-auto
reviewed: 2026-10-14
verdict: approved
---

# Plan review: deploy-notes-roadmap-auto

Checked plan.md against change.md, research.md, issue #465 and the files it touches.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The directory passed to `git diff`/`ls-tree` is a constant, but keep it after `--` so it can never become an option. | Taken into Phase 1. |
| 2 | Warning | `git show <ref>:<path>` resolves the path from the repository root; use `<ref>:./<path>` so it is relative to `cwd`, like `--relative` on the diff. | Taken into Phase 1. |
| 3 | Check | Acceptance case "explicit path unchanged" is covered by the existing CLI test of a missing roadmap. | No change. |
| 4 | Check | A redeploy of the same tag finds the same archived roadmap: the range `prev..to` does not move with later commits. | No change. |

No Critical findings.
