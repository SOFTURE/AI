---
change_id: deploy-tested-tree-earlier-commit
title: "deploy-tested-tree: accept an earlier pull request commit when the last push changed only ignored folders"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: null
branch: claude/project-thread-dqx9ah
created: 2026-11-18
updated: 2026-11-18
---

## Intent

Let `deploy-tested-tree.yml` answer `tested: "true"` when the pull request's newest commit skipped its suite because
that push changed only ignored folders, while an earlier commit with the same tree outside them passed every check.

## Context

An adopting app's pull request checks now skip the heavy jobs on a push that changes only `context/` (the archive
commit that ends every change). That last commit's unit check runs are `skipped`, so the workflow, which read only the
newest commit, answered `"false"` for almost every release, and the unit suite ran again at deploy.

## Scope

- `.github/workflows/deploy-tested-tree.yml`: per-commit check; walk back through at most 10 earlier commits.
- `tests/repo/deploy-workflows.test.ts`, README, CHANGELOG, deploy 0.7.5 and the CLI default of the callers.

## Notes

Research skipped: the gap and the code it touches are one step of one workflow, read in full above; 0.7.4's research
(context/archive/2026-11-18-deploy-tested-tree-1373/research.md) holds the safety argument, which still holds for an
earlier commit (its tree equals the tag's outside the ignored folders, so the base code it ran with is the tag's).
