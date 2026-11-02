---
change_id: theme-notion-dialog-footer-close
status: done
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
- No explicit `type="button"` on the footer's `Button`: Radix `DialogClose` renders `type: "button"` and `asChild`
  keeps it on the child (the theme's `Button` passes no `type`), so the submit described in the issue does not
  reproduce; the new tests (no submit, `type="button"` in the DOM) pass on master and stay as regression guards.
  An explicit prop would duplicate what the primitive guarantees.
- The parity fixture `tests/fixtures/notion-slots.json` is regenerated (`UPDATE_FIXTURES=1`): the Dialog cases now
  list the outline button before the primary one. The design system artifact is synced by its own thread.
- No version bump: the coordinator releases theme-notion with the next combined release.

## Progress

- [x] Phase 1: component (aae44f3)
- [x] Phase 2: docs (aae44f3, with phase 1)
- [x] Implementation review: approved
