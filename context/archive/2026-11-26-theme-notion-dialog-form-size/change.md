---
change_id: theme-notion-dialog-form-size
title: "theme-notion: DialogContent gets a form size and DialogFooter a sticky footer (issue #1515)"
status: open
roadmap_item: null
issue: 1515
branch: claude/project-thread-txjk71
created: 2026-11-26
updated: 2026-11-26
---

## Intent
An adopting app puts a create/edit form in a dialog: about 640 px wide from `md`, full width inside the 16 px phone
gutter, scrolling inside on a short screen, its footer (Cancel, primary) kept at the dialog's bottom while the fields
scroll. The theme gives that without app overrides. Issue #1515 (`enhancement`, `pkg: theme-notion`).

## Context
`DialogContent` sizes today: `default` (`sm:max-w-lg`, no inner scroll), `wide` (`lg:max-w-1/2`, 512 px between `md`
and `lg`), `sm` (scrolls, `sm:max-w-md`), `lg` (a fixed height). None is a form dialog. `DialogFooter` cannot stay at
the bottom of a scrolling dialog. The app works around it with class overrides on both.

## Scope
- `DialogContent size="form"`: height by content up to the viewport's gutter, then scrolling inside
  (`max-h-[calc(100dvh-2rem)] overflow-y-auto`), `max-w-lg` from `sm` and `max-w-2xl` from `md`.
- `DialogFooter sticky`: stays at the bottom edge of a scrolling dialog with a top border on the dialog's surface,
  bleeding to its edges; buttons stay full width and primary on top on a phone (the existing `flex-col-reverse`).
- Unit tests (red first), a gallery case and its baselines, the upstream deltas, the parity fixture, README,
  CHANGELOG `Unreleased`, the "NOTION · Design System" artifact.
- Out of scope: the adopting app; `AlertDialog`, `Sheet`.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: the issue names the problem, the target sizes and a proposal.
