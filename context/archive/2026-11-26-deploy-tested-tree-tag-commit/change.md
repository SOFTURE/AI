---
change_id: deploy-tested-tree-tag-commit
title: "deploy-tested-tree: read the tag's own commit and older pull requests that changed only ignored folders"
status: archived
archived_at: 2026-11-26
roadmap_item: null
issue: null
branch: claude/deploy-tested-tree-tag-commit
created: 2026-11-26
updated: 2026-11-26
---

## Intent

Let `deploy-tested-tree.yml` answer `tested: "true"` when the release's unit suite already passed on the very commit
the tag points to (a release gate), and when the last merged pull request changed only ignored folders while an older
one passed the tag's code.

## Context

In an adopting app the skip answered `"false"` on all 7 releases since it was adopted. Its notices: the last merged
pull request's `coverage` was `skipped` (5 times: package bumps and archives merged without the suite) or missing
(2 times: context-only pull requests). On one of them the app had dispatched its full checks on the release branch's
head minutes before cutting the tag, all green on the same commit, and the release still ran its 24-minute suite.
Replaying 15 releases of two weeks: 1 had green checks on the tag's own commit, 2 had a pull request commit with the
tag's tree; the rest shipped a combination no run had tested, so their suite must stay.

## Scope

- `.github/workflows/deploy-tested-tree.yml`: the tag's own commit first; then up to 5 merged pull requests of the
  tag's history, older ones only while their merge commit still has the tag's tree outside the ignored folders.
- `tests/repo/deploy-workflows.test.ts`, the deploy README and CHANGELOG, deploy 0.7.10 and the CLI defaults of the
  callers.

## Notes

Research skipped: the gap is one step of one workflow, read in full, and the API answers of the failing releases are
quoted above. The safety argument of 0.7.4 (context/archive/2026-11-18-deploy-tested-tree-1373/research.md) holds:
the tag's own commit is the tag's code; an older pull request is accepted only when one of its commits has the tag's
tree outside the ignored folders and passed every named check, and the walk only reaches it while every newer merge
commit kept that tree.
