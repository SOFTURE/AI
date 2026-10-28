---
change_id: theme-notion-timeline-838
status: archived
---

# Plan: Timeline (issue #838)

Input: change.md, research.md. Complexity: small (one new composition, tests, docs, gallery, artifact).

## Phase 1: `Timeline` (TDD)

Files: `themes/theme-notion/src/notion/Timeline.tsx`, `src/index.ts`, `tests/notion/Timeline.test.tsx`,
`tests/gallery/cases.tsx`, `tests/fixtures/notion-slots.json`, `visual/baselines/*/gallery.png`.

1. Tests: structure and classes of one entry, order and keys, time placement per size, marker fill per size and
   colour, dot without an icon, dashed rail, description, badges and content, button with `onSelect` (name starts with
   `actionLabel` and contains the visible text), aside outside the button, plain body without `onSelect`, `data`
   attributes, `className`.
2. Component: grid of marker column (24 px), body, optional aside; the rail as an absolutely positioned span from the
   first marker's centre to the last one's.
3. Gallery: one case per size; refresh the fixture and the baselines.

## Phase 2: docs

README component list and a section with an example; CHANGELOG under `## Unreleased`.

## Phase 3: design system artifact

A `Timeline` component card (guidelines and preview) in "NOTION · Design System", the bundle rebuilt with it.

## Decisions (auto)

- `actionLabel` is an sr-only prefix, not `aria-label`: axe flags a name that does not contain the visible text.
- `line` styles the rail through the entry itself, so a gap entry reads as a dashed stretch of the rail.
- `aside` sits in a third grid column, not inside the body, so marks with popovers stay valid HTML.
- No version bump here; the release is its own step.

## Progress

- [x] Phase 1: Timeline
- [x] Phase 2: docs
- [x] Phase 3: design system artifact, NOTION · Design System versions 29–31 (Timeline card, bundle rebuilt)
- [x] Implementation review: approved

## Notes

- After the first adopter's screenshots, a compact entry keeps its description and badges on one wrapping line (a
  move's route and status), so a move takes two lines instead of three.
