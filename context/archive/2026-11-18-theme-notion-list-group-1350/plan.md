# Plan: a sticky group heading for List (#1350)

## Approach

Two server-safe parts next to `List`, on the theme's tokens, tested like the other List parts.

## Phases

### Phase 1: parts (test-first)

- `tests/notion/List.test.tsx`: `ListGroup` is a `div` with `px-2` and the items' scroll margin, `asChild` keeps the
  app's element; `ListGroupHeading` sticks (`sticky top-0 z-10`), bleeds (`-mx-2 px-4`), is `min-h-10` (the scroll
  margin), draws `border-b` on `background` (page) or `secondary` with a `background` line (tinted); `asChild` renders
  the app's `h3`.
- `src/notion/List.tsx`, `src/index.ts`; gallery cases `ListGroup[surface=page|tinted]`, the parity fixture.
- Done when: `npx vitest run themes/theme-notion` passes; typecheck and ESLint clean.

### Phase 2: browser check, docs, baselines, version

- A Playwright check in a scratch page: scroll the gallery case and measure that the heading stays at the scrollport's
  top edge, spans its full width, and that the next heading pushes it away; a row scrolled into view lands below it.
- README (component list, the List section), CHANGELOG; the gallery baselines refreshed; `npm run release:version --
  theme-notion minor`.
- Done when: the visual suite passes on every project and the version is bumped.

## Progress

- [x] Phase 1: parts (e8a7b35)
- [x] Phase 2: browser check, docs, baselines, version (20d2802, 9cf2967)

Evidence: `npx vitest run themes/theme-notion` 66 files, 1293 tests green; `tsc -p themes/theme-notion --noEmit` and
ESLint clean; the visual suite (184 cases, 4 projects, Chromium 1243) failed only on the four inline `gallery.png`
baselines before the refresh (every isolated case matched) and is green after it; a scratch Playwright measurement of
the `ListGroup[surface=page]` case confirmed the sticking, the full width, the push-away and the scroll margin (see the
implementation review). Version 0.27.0 (0.26.0 went to #1349, merged first).
