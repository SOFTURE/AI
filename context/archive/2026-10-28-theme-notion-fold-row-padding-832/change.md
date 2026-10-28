---
change_id: theme-notion-fold-row-padding-832
title: "theme-notion: FoldRow content with equal padding, indentation opt-in through isInset (issue #832)"
status: archived
roadmap_item: null
issue: 832
branch: claude/project-thread-pfibio
created: 2026-10-28
updated: 2026-10-28
archived_at: 2026-10-28
---

## Intent

Close [issue #832](https://github.com/SOFTURE/AI/issues/832): `FoldRow`'s opened content (`fold-row-content`) is
indented 24 px on the left and 4 px on the right, so a `DetailTable` sits off-centre under the row on a wide screen.
By default the content gets equal padding on all four sides; the current indented look becomes the opt-in
`isInset` prop. The nice-to-have rides along: a `summary` slot replacing title, facts and badges, and optional
`details`, so an app's hand-made rows can use `FoldRow`.

## Context

Labels: `pkg: theme-notion`. Related: #831 (`StatsFold`, same `isInset` rule, in a parallel change). No release in this
change: the coordinator releases in the next combined release. The visual change is mirrored in the
"NOTION · Design System" artifact.

## Constraints

- Without `isInset`, `fold-row-content` has the same padding on all four sides; with it, today's classes.
- Existing call sites (title, facts, badges, detailsLabel, details) compile and render unchanged apart from the padding.
- The API stays consistent with #831: a boolean `isInset`, default `false`.

## Notes

- Framing: skipped. The issue names the problem, the expected layout and the prop.
