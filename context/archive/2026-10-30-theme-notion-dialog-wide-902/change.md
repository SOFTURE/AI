---
change_id: theme-notion-dialog-wide-902
title: "theme-notion: a wide DialogContent and a translatable DialogFooter close label (issues #902, #903)"
status: archived
roadmap_item: null
issue: [902, 903]
branch: claude/project-thread-m7utty
created: 2026-10-30
updated: 2026-10-30
archived_at: 2026-10-30
---

## Intent

Close [issue #902](https://github.com/SOFTURE/AI/issues/902): `DialogContent` is fixed at `sm:max-w-lg`, so an app
that needs a half-screen form dialog writes its own width classes. Give it `size?: "default" | "wide"`, where `wide`
is half the viewport from `lg` and `max-w-lg` below it.

Close [issue #903](https://github.com/SOFTURE/AI/issues/903): `DialogFooter showCloseButton` renders a literal
English "Close". Default it to `messages.dialog.close` and add `closeLabel?: string`, like `DialogContent`.

## Context

Labels: `pkg: theme-notion`. Both issues touch only `themes/theme-notion/src/ui/dialog.tsx`, so one change and one
pull request closes both. Independent of the marketing-kit wave (#897, #898, #899). No version bump: theme-notion
joins the batched release at the end of the wave.

## Constraints

- Backwards compatible: defaults render the same classes; only new optional props.
- Every changed line of `src/ui` is listed in `tests/upstream/deltas.ts`; the parity fixture and the visual
  baselines are regenerated for the new gallery case.

## Notes

- Framing: skipped. Both issues name the component, the prop and the acceptance.
