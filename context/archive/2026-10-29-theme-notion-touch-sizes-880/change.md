---
change_id: theme-notion-touch-sizes-880
title: "theme-notion: touch sizes for DropdownMenu items, Tabs, AccordionTrigger and Dialog's close button (issue #880)"
status: archived
roadmap_item: null
issue: 880
branch: claude/project-thread-2p9wv8
created: 2026-10-29
updated: 2026-10-29
archived_at: 2026-10-29
---

## Intent

Close [issue #880](https://github.com/SOFTURE/AI/issues/880), the part of #859 that 0.9.0 left out: the dropdown menu
items, `TabsTrigger`, `AccordionTrigger` and Dialog's close button cannot reach the `touch-target` token (44 px)
without hand-written classes. Give them a `touch` size, set at the list (`DropdownMenuContent`, `TabsList`) or on the
control itself, with the control's own size winning, the same rule as `Select`.

## Context

Labels: `enhancement`, `pkg: theme-notion`. Runs in parallel with #872 (PR #882, also theme-notion): master is merged
in before READY. No version bump: one batch release closes the wave.

## Constraints

- Backwards compatible: existing sizes, defaults and rendered classes stay; only new optional props.
- Every changed line of `src/ui` is listed in `tests/upstream/deltas.ts`; the parity fixture is regenerated.

## Notes

- Framing: skipped. The issue names the components, the size rule and the app's workaround.
