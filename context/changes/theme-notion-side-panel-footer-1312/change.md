---
change_id: theme-notion-side-panel-footer-1312
title: "theme-notion: SidePanel footer (issue #1312)"
status: impl_reviewed
roadmap_item: null
issue: 1312
branch: claude/project-thread-wxiy3s
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Close [issue #1312](https://github.com/SOFTURE/AI/issues/1312): `SidePanel` takes an optional `footer`, a strip with
a top border pinned below its scrolling content, so an adopting app can put an action at the panel's foot (the button
that unfolds a column folded next to the panel) without writing its own layout around the package component.

## Context

Labels: `enhancement`, `pkg: theme-notion`. Package `themes/theme-notion` 0.19.0. `SidePanel` today renders a
header and one scrolling `side-panel-content` area; anything in `children` scrolls with the list. Issue #1311 (a
resize handle and a width for `SidePanel`) is open in parallel and touches the same file; the props are independent.

## Scope

- `SidePanel footer?: ReactNode`, rendered after the content in `data-slot="side-panel-footer"`
  (`flex flex-none border-t border-border p-2`, the same strip a column's own foot uses).
- Tests, README line, `## Unreleased` in the CHANGELOG; minor version bump (0.20.0) so the adopting app can use it.

## Constraints

- Without `footer` the markup stays exactly as today.
- Tokens only; no new dependency.

## Notes

- Research skipped: a single additive prop on one component; the component, its tests and README were read in full.
- Frame skipped: the gap is concrete (an adopting app's footer action) and the fix is the smallest one.

## Decisions (auto)

- A `footer` prop rather than a `SidePanelFooter` child component: the panel owns its layout (header, scrolling
  content, footer), so a slot prop keeps the footer out of the scroll container without the caller knowing the
  markup.
- Released as 0.20.0 from this change (minor: new optional prop), because the adopting app waits for it.
