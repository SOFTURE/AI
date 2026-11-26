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
- [x] Phase 1: touch-size confirmation buttons (new test red before the code: `max-md:h-touch-target` missing on both buttons; after: `npx vitest run themes/theme-notion` 1414 tests passed; typecheck, ESLint, language gate and build in the pre-commit and below) c2211b7
- [x] Phase 2: Design System artifact (version 97-98: `className:"max-md:h-touch-target"` on both confirmation buttons of the `RowActionsMenu` IIFE in `bundle.js`, one rule appended to `bundle.css` as a trailing `@layer utilities{}`, `lastChange` in the index; checked with `node vm.Script` and in Chromium with no console error: computed `height` 44px at 390 px and 28px at 1280 px for Keep and Delete)
