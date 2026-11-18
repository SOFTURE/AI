# Plan: DetailTable fit and DocumentRow details (theme-notion, #1349)

## Approach

One class on `DetailTable`, one optional prop on `DocumentRow`, proven by unit tests and a geometry check.

## Phases

### Phase 1: components (test-first)

- `tests/notion/DetailTable.test.tsx`: the table has `table-fixed`.
- `tests/notion/Document.test.tsx`: `details` renders as `document-row-details` after the size, inside the open
  button; left out when not given.
- `src/notion/DetailTable.tsx`, `src/notion/Document.tsx`.
- Done when: `npx vitest run themes/theme-notion` passes; typecheck and ESLint clean.

### Phase 2: gallery, geometry, docs, version

- Gallery case `DetailTable[documents]`: a row whose value is a `DocumentList` with `details` and an action button;
  the parity fixture if the inventory asks for it.
- `visual/fit.spec.ts`: that table copied into a 360 px parent stays inside it, the actions stay inside the row and
  the details wrap under the title.
- New and changed baselines refreshed only where the change shows; README, CHANGELOG;
  `npm run release:version -- theme-notion minor`.
- Done when: the visual suite passes on every project.

## Progress

- [ ] Phase 1: components
- [ ] Phase 2: gallery, geometry, docs, version
