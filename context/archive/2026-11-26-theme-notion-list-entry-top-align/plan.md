# Plan: theme-notion-list-entry-top-align

## Approach
In `src/notion/List.tsx`, `ListEntry`: the root's `items-center` becomes `items-start`, the side's `items-center`
becomes `items-start`, and the arrow's span gets `h-5 items-center` so the chevron is centred on the title's 20 px
line. JSDoc, README and CHANGELOG say that both sides align to the top.

## Phases
### Phase 1: top alignment (TDD)
- Tests first (red): in `tests/notion/List.test.tsx` the root and the side carry `items-start` (not `items-center`)
  and the arrow `h-5 items-center`; in `visual/fit.spec.ts` the gallery entry (title and two detail lines) has its
  badge's and arrow's middles within 2 px of the title line's middle at the desktop viewports.
- Code, README, CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, the ListEntry tests of `visual/fit.spec.ts` and the gallery
  screenshots pass, typecheck, lint and build pass.

### Phase 2: Design System artifact
- Patch the `ListEntry` IIFE in the "NOTION · Design System" artifact's `bundle.js` (and `bundle.css` if a class is
  missing), publish.

## Decisions (auto)
- No `align` prop: top alignment is what the component describes, and single-line rows move by at most 4 px.
- Released as a minor together with #1495 (a fix in layout; no dependent range broken).

## Progress
- [x] Phase 1: top alignment (TDD) (red first: the new unit test and the updated root class test failed, and the
  new `visual/fit.spec.ts` test measured the badge 7 px below the title line's middle at both desktop viewports;
  after: `npx vitest run themes/theme-notion` 1410 tests passed (the `notion-slots.json` parity fixture regenerated
  with `UPDATE_FIXTURES=1`), the ListEntry tests of `visual/fit.spec.ts` 16 passed, `visual/gallery.spec.ts` 148
  passed, typecheck, ESLint, the language gate and `npm run build` passed) e4b602e
- [x] Phase 2: Design System artifact (version 93-94: the `ListEntry` IIFE in `bundle.js` patched (root and side
  `items-start`, arrow `h-5 items-center`; both classes already in `bundle.css`), the List card README notes the top
  alignment; rendered in Chromium at 1280 px with a three-line identity: the title line's, the badge's and the
  arrow's middles all at 14 px, no console error)
