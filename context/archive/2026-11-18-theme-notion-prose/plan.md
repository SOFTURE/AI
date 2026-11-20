# Plan: Prose (theme-notion)

## Approach

One server-safe composition with descendant selectors on the theme's tokens, tested like the other compositions.

## Phases

### Phase 1: component (test-first)

- `tests/notion/Prose.test.tsx`: renders a `div` with `data-slot="prose"` and the token classes; `asChild` keeps the
  app's element and adds its classes; HTML passed by the app renders inside the slot.
- `src/notion/Prose.tsx`, `src/index.ts`; the gallery case, the parity fixture.
- Done when: `npx vitest run themes/theme-notion` passes; typecheck and ESLint clean.

### Phase 2: docs, baselines, version

- README (component list, a section with an example), CHANGELOG; the inline gallery baselines refreshed (the only
  images the new case changes); `npm run release:version -- theme-notion minor` (0.25.0).
- Done when: the visual suite passes on every project and the version is 0.25.0.

## Progress

- [x] Phase 1: component
- [x] Phase 2: docs, baselines, version

Evidence: `npx vitest run themes/theme-notion` 66 files, 1283 tests green; `tsc -p themes/theme-notion --noEmit` and
ESLint clean; the visual suite (184 cases, 4 projects) green after refreshing only the four `gallery.png` baselines
(Chromium 1243): every isolated case matched before the refresh, only the inline gallery differed, by the new case;
axe passes on the gallery in light and dark, desktop and phone.
