---
change_id: theme-notion-stats-fold-width-831
title: "theme-notion: StatsFold content spans the header's width, the inset is an opt-in prop (issue #831)"
status: open
roadmap_item: null
issue: 831
branch: claude/project-thread-a0o397
created: 2026-10-28
updated: 2026-10-28
---

## Intent

Close [issue #831](https://github.com/SOFTURE/AI/issues/831): `StatsFold` indents its content with a left-only
`pl-6`, so a card or a full-width bar inside it starts under the title and ends at the header's right edge, off-centre
under the header row. By default the content spans the fold's full width (the same edges as the summary row); the
indented look becomes an explicit `isInset` prop, `false` by default.

## Context

Labels: `bug`, `pkg: theme-notion`. No release in this change: the coordinator releases in the next combined release.
Issue #832 (`FoldRow`, the same pattern) runs in parallel; both use the same prop name and meaning.

## Constraints

- No one-sided horizontal padding by default; `isInset` restores today's indent exactly.
- The summary row is unchanged.
- The NOTION · Design System artifact mirrors the change.

## Notes

- Framing: skipped. The issue names the problem and the API.
