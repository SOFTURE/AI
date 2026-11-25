# Plan: theme-notion-badge-data-color

## Approach
Add `data-color` to the element `Badge` renders in `themes/theme-notion/src/ui/badge.tsx`, test first, before the
props spread so a caller's own value wins.

## Phases
### Phase 1: data-color on Badge (TDD)
- `themes/theme-notion/tests/ui/badge.test.tsx` first (red): `<Badge variant="tag" color="red">` renders
  `data-color="red"` and `data-variant="tag"`, for every palette colour; no `data-color` without a colour or with
  `none`; a caller's `data-color` wins; `Status` renders exactly one `data-color`, its own.
- `src/ui/badge.tsx`; the upstream delta in `tests/upstream/deltas.ts`; the parity fixture regenerated if it changes
  (`UPDATE_FIXTURES=1`); README (Badge paragraph), CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, typecheck, lint and build pass.

## Progress
- [x] Phase 1: data-color on Badge (10 new Badge tests red before the change; after: `npx vitest run
  themes/theme-notion` 70 files, 1365 tests passed, two `Stats` aside assertions now name `data-color`; parity
  fixture unchanged; `npm run typecheck`, `npm run lint` incl. the language gate, `npm run build` passed) b722022
