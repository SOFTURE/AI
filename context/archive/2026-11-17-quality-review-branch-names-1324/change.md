---
change_id: quality-review-branch-names-1324
title: "quality-review: report branch names that coexist (issue #1324)"
status: archived
archived_at: 2026-11-17
roadmap_item: null
issue: 1324
branch: claude/project-thread-fe9qdw
created: 2026-11-17
updated: 2026-11-17
---

## Intent

Close [issue #1324](https://github.com/SOFTURE/AI/issues/1324): the default report branches of 0.2.0 nest
(`quality-review`, `quality-review/security`, `quality-review/security/<scope-slug>`, `quality-review/<scope-slug>`),
and git cannot hold a branch `a/b` next to `a/b/c`. Once a whole-repository run has delivered its branch, every scoped
run of the same focus fails in `deliver` with `cannot lock ref`. Every default branch must coexist with every other.

## Context

Labels: `pkg: quality-review`, `bug`. Package `tools/quality-review` 0.2.0 (published). The CLI `resolve` command
prints `branch-suffix=`; the reusable workflow `.github/workflows/quality-review.yml` builds
`quality-review${suffix:+/$suffix}` from it. Issue #1325 runs in parallel in the same package (other files); the two
threads agreed: no version bump here, CHANGELOG under `## Unreleased`, one 0.3.0 release PR after both merge.

## Scope

- A flat naming scheme without `/`: `quality-review-general`, `quality-review-security` (whole repository), and
  `quality-review-<focus>--<scope-slug>` (scoped).
- The CLI owns the name: `getReportBranch(focus, scope)`; `resolve` prints a new `report-branch=` line;
  `branch-suffix=` stays as it was for callers that read it.
- The workflow takes `report-branch` when the input `branch` is empty; an older pinned CLI that prints no such line
  falls back to the 0.2.0 names.
- Tests, README (inputs table, `resolve`), CHANGELOG `## Unreleased`.

## Constraints

- No name is a `/`-prefix of another, and none is a `/`-prefix of a 0.2.0 name (`quality-review`,
  `quality-review/...`) or nests under one.

## Notes

- Research skipped: the defect, the git rule and the two places that build the name (`getBranchSuffix` in
  `src/cli/command.ts`, the resolve step of the workflow) are named in the issue and were read directly.
- Frame skipped: the cause is a git ref rule, measured in the issue's log.

## Decisions (auto)

- The general whole-repository run moves from `quality-review` to `quality-review-general`: an adopter who ran a 0.2.0
  security run holds `quality-review/security`, and git refuses `quality-review` next to it (the test caught this with
  the first draft, which kept `quality-review`). The focus is always named, so every name has the same shape.
- `--` before the scope slug: a slug never holds two dashes in a row (`getScopeSlug` collapses runs of non
  alphanumerics into one dash), so the scope part is always unambiguous.
- A new `report-branch=` line instead of changing `branch-suffix=`: the suffix is documented output, and the workflow
  can fall back when an adopter pins an older `cli-version`.
- The 0.2.0 branches already pushed by adopters are left alone: the new names do not collide with them, and the
  CHANGELOG tells adopters to close their pull requests and delete them.
