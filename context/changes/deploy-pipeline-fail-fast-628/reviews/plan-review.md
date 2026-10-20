---
change_id: deploy-pipeline-fail-fast-628
reviewed: 2026-10-20
verdict: approved
---

# Plan review: deploy-pipeline-fail-fast-628

Checked plan.md against change.md, research.md, issue #628 and the workflows.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | A watcher that fires while the deploy runs would cancel it halfway. | Planned: only parts before `build` are watched; the test asserts no watcher needs `build`, `deploy` or `report`. |
| 2 | Major | `actions: write` declared inside `deploy-release-checks.yml` would break every pull request caller at start. | Planned: the cancel is its own workflow; the checks keep `contents: read` (test). |
| 3 | Major | The image built in parallel must be the tag's commit, not the dispatch ref. | Planned: `deploy-app.yml` outputs `sha` from the branch guard, which resolves the tag; the image takes it. |
| 4 | Minor | Two watchers can fire for one failure (`failure()` sees ancestors); the second cancel is refused by the API. | Planned: the cancel warns instead of failing. |
| 5 | Minor | `ssh-keygen -y` prompts for a passphrase without `-P`. | Planned: `-P ''`, stdin closed. |
| 6 | Minor | Check-only call with `prebuilt-image` would validate an image it never uses. | Planned: refused with `build: false`. |
| 7 | Check | The cleanup step runs `always()` and already deletes `.env.prod`, the key and the known hosts. | No change. |
| 8 | Check | A protected environment asks for approval for the preflight job too. | Documented in README. |

No Critical findings.
