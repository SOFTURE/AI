---
change_id: charts-free-flag-style-711
title: "charts: ChartFlag applies style on a free flag of one row (issue #711)"
status: archived
roadmap_item: null
issue: 711
branch: claude/project-thread-ofuvde
created: 2026-10-24
updated: 2026-10-24
archived_at: 2026-10-24
---

## Intent

Close [issue #711](https://github.com/SOFTURE/AI/issues/711): a `ChartFlag` without `xPercent` and with the default
`rows = 1` drops its `style`, because the inline style is built only when `spanStyle` is set. A free flag must apply
`style` whatever `rows` is, as the prop's documentation says.

## Context

Labels: `bug`, `pkg: charts`. No release in this change: the coordinator releases charts.

## Constraints

- A free flag with no `style` and one row still renders no `style` attribute; placed flags are unchanged.
- A bug fix starts with a test that fails without it.

## Notes

- Framing: skipped. The issue names the line, the cause and the fix.
