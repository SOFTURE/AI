---
change_id: theme-notion-scrollable-tabs-908
status: archived
---

# Plan: scrollable tabs and a horizontal scroll bar (issue #908)

Input: change.md, research.md. Complexity: small.

## Phase 1: components (TDD)

Files: `themes/theme-notion/src/ui/tabs.tsx`, `src/ui/scroll-area.tsx`, `tests/ui/tabs-scrollable.test.tsx`,
`tests/ui/scroll-area.test.tsx`, `tests/upstream/deltas.ts`, `tests/gallery/cases.tsx`,
`tests/fixtures/notion-slots.json`, `visual/fit.spec.ts`, `visual/baselines/**`.

- `tabsListVariants` axis `scrollable` (`false`, `true`): `relative w-full max-w-full min-w-0 justify-start
  overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:thin]`, no fixed height, `pb-1.5` for the
  line underline, `*:flex-none`. `data-scrollable="true"` on the list; the `Tabs` root gets
  `has-data-[scrollable=true]:min-w-0`.
- `useCentredActiveTrigger`: on mount and on every `data-state` change under the list, set `scrollLeft` so the active
  trigger is centred. The list merges the caller's `ref`.
- `ScrollArea scrollbars` (`vertical` default, `horizontal`, `both`).
- Tests: classes and attribute, the plain list unchanged, centring after a click; the bars per option.
- Gallery: `TabsList[scrollable=…]` in a 288 px grid cell, `ScrollArea[scrollbars=horizontal]`; fixture, baselines;
  a fit spec that the strip keeps to its cell, the root does not widen and the active tab is visible.

## Phase 2: docs

README component notes (`tabs`, `scroll-area`), CHANGELOG `## Unreleased`.

## Decisions (auto)

- Ships in one pull request with #907: both theme-notion, no shared files, one CI run instead of two.
- The scroll bar of a scrollable list stays visible but thin, so a mouse user sees it scrolls.
- The `Tabs` root class is conditional on a scrollable list (`has-data-…`), so no other layout changes.
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: components, 59bd30d
- [x] Phase 2: docs, 59bd30d
- [x] Implementation review: approved
