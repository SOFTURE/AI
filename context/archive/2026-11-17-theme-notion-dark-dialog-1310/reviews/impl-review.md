# Implementation review: theme-notion-dark-dialog-1310

Verdict: approved, no findings left open.

- Matches the plan: `DialogContent`, `AlertDialogContent` and `SheetContent` swap `bg-background` for
  `bg-popover text-popover-foreground`; `CommandDialog` and `SheetMenu` follow through them. `DocumentViewer` keeps
  `bg-background text-foreground` explicitly (full screen, nothing behind it), recorded under Decisions.
- Upstream guard: the dialog and alert-dialog deltas carry the new classes and name #1310; sheet gained its own
  surface delta. The design-system slot snapshot was regenerated with `UPDATE_FIXTURES=1`; its diff is only the
  surface classes on `dialog-content`, `alert-dialog-content`, `sheet-content` and the `document-viewer` row.
- Light mode: `popover` and `background` are both `#ffffff`, the foregrounds equal, so nothing changes there.
- Evidence: `npx vitest run themes/theme-notion`: 63 files, 1246 tests passed; the new
  `tests/ui/modal-surface.test.tsx` failed (6 of 6) before the fix. Pre-commit typecheck, ESLint and the language
  gate green.
- Version: 0.21.1 (patch), CHANGELOG `## 0.21.1`, lockfile changes only the version line; the local tag was dropped.
