# Plan: theme-notion-page-layout

## Approach
Add `PageLayout` in `src/notion/PageLayout.tsx`, composed of `PageHeader` and a grid; export it from the root.

## Phases
### Phase 1: PageLayout (TDD)
- `tests/notion/PageLayout.test.tsx` first (red): renders the header's h1 then the children in one
  `data-slot="page-layout"` grid with `w-full min-w-0 gap-4`; `width="content"` adds `mx-auto max-w-3xl` and
  `data-width="content"`; `className` merges; header props pass through (crumbs, actions).
- `src/notion/PageLayout.tsx`, `src/index.ts` export; the index export test and inventory if they list exports;
  README (components list and a section), CHANGELOG 0.31.0, `package.json` version.
- Done when: `npx vitest run themes/theme-notion` passes (the class-coverage test included), typecheck and lint pass.

### Phase 2: design system artifact
- Add `PageLayout` to the NOTION · Design System artifact (separate IIFE module, type, card), render-checked.

## Progress
- [x] Phase 1: PageLayout (new test red before the component; after: `npx vitest run themes/theme-notion` 68 files,
  1324 tests passed; `playwright test -g "gallery of inline cases"` 4 passed after the baseline update) dafdab4
- [x] Phase 2: design system artifact (version 72 content, 73 index; preview rendered in Chromium, gap 16px, no errors)
