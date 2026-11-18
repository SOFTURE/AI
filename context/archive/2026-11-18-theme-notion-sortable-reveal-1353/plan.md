# Plan: a SortableHandle that shows on hover (#1353)

## Approach

One prop on `SortableHandle` and one group marker on `SortableItem`, both in `src/notion/Sortable.tsx`.

## Phases

### Phase 1: prop and tests (test-first)

- `tests/notion/Sortable.test.tsx`: `SortableItem` carries `group/sortable-item`; a default handle has
  `data-reveal="always"` and no `opacity-0`; `reveal="hover"` adds the fine-pointer classes, stays focusable and in
  the tab order; the generated CSS puts `opacity: 0` inside `@media (pointer: fine)` and brings it back under the
  row's `:hover`, `:focus-within` and `[data-dragging]`.
- `src/notion/Sortable.tsx`; the parity fixture regenerated (`UPDATE_FIXTURES=1`).
- Done when: `npx vitest run themes/theme-notion` passes; typecheck and ESLint clean.

### Phase 2: browser check, docs, version

- A scratch Playwright page with the package's CSS: opacity of the grip at rest, on row hover, on focus within, on a
  coarse pointer (`hasTouch`, `isMobile`).
- README (the Sortable section), CHANGELOG; `npm run release:version -- theme-notion minor` (0.28.0, lockfile flags
  restored from master, local tag removed).
- Done when: the browser check shows 0 / 1 / 1 / 1 and the version is bumped.

## Progress

- [x] Phase 1: prop and tests (16c73d7)
- [x] Phase 2: browser check, docs, version (86a9a01, ba66156)

Evidence: `npx vitest run themes/theme-notion` 67 files, 1305 tests green; typecheck and ESLint clean (pre-commit);
parity fixture regenerated (only `group/sortable-item` and `data-reveal` added). Browser check (scratch Playwright page
with the classes Tailwind generates, Chromium headless shell 1243, reduced motion): fine pointer opacity rest 0, row
hover 1, focus within 1, `data-dragging` 1; coarse pointer (`hasTouch`, `isMobile`) 1 in every state. Version 0.28.0
(npm latest is 0.27.0); no package depends on theme-notion.
