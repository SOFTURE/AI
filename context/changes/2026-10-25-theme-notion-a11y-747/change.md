---
change_id: theme-notion-a11y-747
title: "theme-notion: ItemGroup list items and a focusable ScrollArea (issue #747)"
status: in_progress
roadmap_item: null
issue: 747
branch: claude/project-thread-pnvbf2
created: 2026-10-25
updated: 2026-10-25
---

## Intent

Close [issue #747](https://github.com/SOFTURE/AI/issues/747): axe (WCAG 2.1 A/AA) reports no
`aria-required-children` for an `ItemGroup` of `Item`s and no `scrollable-region-focusable` for a `ScrollArea`
in `@softure-ai/theme-notion`.

## Context

- Labels: `bug`, `pkg: theme-notion`.
- Found by the accessibility layer of the component gallery (#741), which lists both as known violations.

## Constraints

- Keep the list semantics: `Item` becomes a `listitem` inside an `ItemGroup`, `ItemGroup` keeps `role="list"`.
- The viewport takes `tabIndex={0}` by default and stays overridable.
- No version bump (batched release). English only.

## Notes

- Framing: skipped. The issue names the outcome and the fix.
