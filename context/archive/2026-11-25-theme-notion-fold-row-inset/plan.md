# Plan: theme-notion-fold-row-inset

## Approach
Change the padding classes in `themes/theme-notion/src/notion/FoldRow.tsx` (summary, `CONTENT_CLASS`,
`INSET_CONTENT_CLASS`, actions) to one 8 px horizontal inset, test first.

## Phases
### Phase 1: one inset (TDD)
- `tests/notion/FoldRow.test.tsx` first (red): the summary carries `px-2` (not `px-1`); the default content is
  `flex flex-col gap-2 px-2 py-3 empty:hidden`; the inset content `flex flex-col gap-2 py-2 pr-2 pl-8 empty:hidden`;
  the actions bar has `pr-2`.
- `src/notion/FoldRow.tsx`; the parity fixture regenerated (`UPDATE_FIXTURES=1`); the visual baselines updated
  (`npm run test:visual -w @softure-ai/theme-notion -- --update-snapshots`) and the gallery screenshot checked;
  README (`FoldRow` paragraph), CHANGELOG `## Unreleased` with the app's override to drop.
- Done when: `npx vitest run themes/theme-notion` passes, typecheck and lint pass, the visual spec passes.

## Progress
- [x] Phase 1: one inset (the three FoldRow tests red before the change; after: `npx vitest run themes/theme-notion`
  68 files, 1324 tests passed; typecheck and lint passed; visual spec 192 passed, the four `gallery.png` baselines
  updated, the diff confined to the FoldRow cases; opened rows measured in Chromium: default content at the chevron's
  x (32 px), `isInset` content at the title's x (56 px)) c0f4944
