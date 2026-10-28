---
change_id: theme-notion-stats-fold-width-831
status: done
---

# Plan: StatsFold content width (issue #831)

Input: change.md, research.md. Complexity: small (one prop, tests, docs).

## Phase 1: `isInset` (TDD)

Files: `themes/theme-notion/src/notion/Stats.tsx`, `themes/theme-notion/tests/notion/Stats.test.tsx`.

1. Tests first: without the prop the content is `flex flex-col gap-3 pt-2 pb-1` (no horizontal padding) and carries
   `data-inset="false"`; with `isInset` it adds `pl-6` and `data-inset="true"`.
2. `StatsFoldProps.isInset?: boolean` (default `false`), documented in the TSDoc.

## Phase 2: docs and gallery

`themes/theme-notion/README.md` (the prop next to the example), `CHANGELOG.md` under `## Unreleased`, the parity
fixture (`tests/fixtures/notion-slots.json`) refreshed. The gallery case keeps the default: the fold is closed there,
so the visual baselines do not move (checked: 84 visual tests pass unchanged).

## Phase 3: design system artifact

Update the bundle and publish to NOTION · Design System (recipe in project memory); the preview shows the default.

## Decisions (auto)

- `isInset` keeps today's left-only `pl-6` exactly ("the current indented look, opt-in"): it aligns the content with
  the title after the chevron, which is the point of the inset; a symmetric right padding would change the opt-in look.
- Default has no horizontal padding: the row's edges are the `<details>` edges, so the content matches them.
- `data-inset` on the content makes the layout readable in tests and app selectors, like `StatCards`' `data-layout`.
- No version bump: the coordinator releases.

## Progress

- [x] Phase 1: isInset, 0481325
- [x] Phase 2: docs and parity fixture, 0481325
- [x] Phase 3: design system artifact, NOTION · Design System versions 21-22 (bundle patched in place, `index.d.ts`,
  StatCards README and preview; render-checked light and dark: the content's edges equal the summary row's)
- [x] Implementation review: approved
