---
change_id: theme-notion-dialog-footer-close
title: "theme-notion: the dialog footer's close button never submits a form (issue #921)"
status: in_progress
roadmap_item: null
issue: 921
branch: claude/project-thread-eq7qpx
created: 2026-11-01
updated: 2026-11-01
---

## Intent

`DialogFooter showCloseButton` renders its close button as a `<button>` without `type`, so in a form dialog, where
the footer sits inside the `<form>`, "Cancel" submits the form before the dialog closes. It also renders the close
button after `children`, so with a submit button in `children` the cancel lands right of the submit on wide screens.

## Acceptance

- `<form><DialogFooter showCloseButton closeLabel="Anuluj"><Button type="submit">Zapisz</Button></DialogFooter></form>`:
  clicking "Anuluj" closes the dialog and does not submit the form.
- The close button comes before `children`: cancel then confirm on wide screens, confirm above cancel on phones.

## Context

Issue #921 (label `bug`), found by an adopting app on theme-notion 0.10.2. No other session has worked on it: no
open pull request, master's `DialogFooter` still renders the button without `type`.

## Constraints

- Every changed line of `src/ui` is listed in `tests/upstream/deltas.ts`.
- No release in this change: the coordinator ships it in the next combined release.

## Notes

- Framing: skipped. The issue names the defect, the fix and the acceptance.
