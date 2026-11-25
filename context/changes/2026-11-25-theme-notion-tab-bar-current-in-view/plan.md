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
- [ ] Phase 1: current tab in view and overflow cue
