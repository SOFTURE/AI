# Plan: theme-notion-row-actions-confirm-touch

## Approach
One constant `BUTTON_TOUCH_CLASS = "max-md:h-touch-target"` in `src/notion/RowActionsMenu.tsx`, passed as `className`
to the confirmation's `AlertDialogCancel` and `AlertDialogAction`.

## Phases
### Phase 1: touch-size confirmation buttons (TDD)
- Test first (red) in `tests/notion/RowActionsMenu.test.tsx`: after opening the confirmation, both buttons carry
  `max-md:h-touch-target` and keep `h-7`.
- Code, CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes; typecheck, lint and build pass.

### Phase 2: Design System artifact
- Patch the bundled `RowActionsMenu` and add the utility to `bundle.css`; publish.

## Decisions (auto)
- A responsive height class rather than `size="touch"`, so a desktop keeps the compact buttons (the issue's expected
  result).
- `h-touch-target` (height), not `min-h`, matching `Button size="touch"`; the buttons have one line of text.
- Released as a patch: a fix with no API change.

## Progress
- [ ] Phase 1: touch-size confirmation buttons
- [ ] Phase 2: Design System artifact
