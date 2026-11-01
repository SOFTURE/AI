---
change_id: theme-notion-dialog-footer-close
status: in_progress
---

# Plan: the dialog footer's close button never submits a form

Input: change.md, research.md. Complexity: small.

## Phase 1: component (TDD)

Files: `themes/theme-notion/src/ui/dialog.tsx`, `tests/ui/dialog.test.tsx`, `tests/upstream/deltas.ts`.

- Tests first: in a `<form>` with an `onSubmit` spy, clicking the footer's close button closes the dialog and does
  not submit; the close button has `type="button"`; it precedes the children in the DOM.
- `<Button type="button" variant="outline">`, rendered before `{children}`.
- Delta entries for the moved block and the `type`.

## Phase 2: docs

README `dialog` note (the close button's order and type), CHANGELOG `## Unreleased`.

## Decisions (auto)

- The close button moves before `children` with no `closePosition` option: the cancel-then-confirm order is what a
  form dialog wants, and an app that wants another order places its own `DialogClose` (the simplest fix that meets
  the issue).
- No version bump: the coordinator releases theme-notion with the next combined release.

## Progress

- [ ] Phase 1: component
- [ ] Phase 2: docs
- [ ] Implementation review
