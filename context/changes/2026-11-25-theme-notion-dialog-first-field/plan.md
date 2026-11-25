# Plan: theme-notion-dialog-first-field

## Approach
A small helper in `themes/theme-notion/src/lib/focus-first-field.ts` that wraps an `onOpenAutoFocus` handler: it calls
the app's handler, and unless that prevented the default, focuses the first form control inside the content and
prevents Radix's own focus. `DialogContent` and `SheetContent` pass it to the Radix content. Test first.

## Phases
### Phase 1: focus the first field (TDD)
- `tests/ui/dialog-first-field.test.tsx` first (red): a dialog and a sheet whose first focusable is a
  `TooltipTrigger` open with focus on the input and no `role="tooltip"` in the page; a dialog with no field keeps
  Radix's default (the first button); an app's `onOpenAutoFocus` that prevents the default wins; a disabled or hidden
  input is skipped; Tab from the field reaches the next element as before (the tooltip trigger still opens on
  keyboard focus).
- `src/lib/focus-first-field.ts`, `src/ui/dialog.tsx`, `src/ui/sheet.tsx`, the two upstream deltas, README
  (Dialog/Sheet note), CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, typecheck and lint pass, build passes.

## Progress
- [ ] Phase 1: focus the first field
