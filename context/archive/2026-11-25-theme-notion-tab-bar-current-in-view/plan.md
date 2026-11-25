# Plan: theme-notion-tab-bar-current-in-view

## Approach
In `themes/theme-notion/src/notion/TabBar.tsx` add `"use client"`, a nav ref and two effects: one keeps the current
link in view (`[current]`), one tracks overflow on each side (scroll listener plus `ResizeObserver` when present) and
sets `data-overflow-start` / `data-overflow-end`. The nav's classes gain the two mask variants.

## Phases
### Phase 1: current tab in view and overflow cue (TDD)
- `tests/notion/TabBar-scroll.test.tsx` first (red, happy-dom with a stubbed layout: 5 tabs of 100 px in a 250 px
  strip): a late current tab scrolls the strip so it ends at the right edge; an early one leaves `scrollLeft` at 0;
  changing `current` re-scrolls; the page (`window.scrollTo`, `scrollIntoView`) is never used; the overflow attributes
  follow the scroll position (end only at 0, both in the middle, start only at the end, none without overflow).
- Markup test of the nav classes updated; parity fixture regenerated (`UPDATE_FIXTURES=1`); README (`TabBar`),
  CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, typecheck, lint and build pass, the visual spec passes.

## Progress
- [x] Phase 1: current tab in view and overflow cue (6 of 9 new tests red before the change; after: `npx vitest run
  themes/theme-notion` 69 files, 1338 tests passed; typecheck, ESLint, language gate and `npm run build` passed; the
  built `dist/notion/TabBar.js` keeps `"use client"`; the visual spec runs in CI (`themes.yml`), the container's
  Playwright build lacks the pinned headless shell) 34927a5
- [x] Implementation review fix: the current tab keeps a fade's width (32 px) of room, clamped to the strip, so the
  end fade never covers a middle tab; test added (18 TabBar tests pass)
