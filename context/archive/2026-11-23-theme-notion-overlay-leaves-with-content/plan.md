# Plan: theme-notion-overlay-leaves-with-content

## Approach
Give each modal overlay its content's exit duration, so the overlay and content portals unmount together.

## Phases
### Phase 1: overlay exit duration (TDD)
- `tests/behaviour/overlays.test.tsx`: for `Dialog`, `AlertDialog` and `Sheet`, the overlay's exit duration equals
  the content's (red first).
- `src/ui/dialog.tsx`, `src/ui/alert-dialog.tsx`, `src/ui/sheet.tsx`; `tests/upstream/deltas.ts` with the reason; the
  parity fixture refreshed; CHANGELOG; version 0.30.1.
- Done when: the package tests, typecheck and lint pass; the adopting app's browser test that reopens the dialog
  during the content's exit passes on 0.30.1.

## Progress
- [x] Phase 1: overlay exit duration (new test red before the fix: 3 failed, overlay "default" vs content "200"/"300";
  after: `npx vitest run themes/theme-notion/tests` 67 files, 1318 tests passed).
