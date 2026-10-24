---
change_id: charts-free-flag-style-711
status: archived
---

# Plan: ChartFlag applies style on a free flag (issue #711)

Input: change.md, research.md. Complexity: trivial (one expression, one test, a changelog line).

## Phase 1: fix (TDD)

Files: `foundation/charts/src/svg/flag.tsx`, `foundation/charts/tests/flag-free-style-711.test.tsx`,
`foundation/charts/CHANGELOG.md`.

1. Test first: a free flag with `rows` 1 (default and explicit) and `style={{ bottom: "40%" }}` renders
   `style="bottom:40%"`; with `rows={2}` it renders the rows variable and the style; with no style it renders no
   `style` attribute. It fails on master for the one-row cases.
2. In `ChartFlag`: the free branch becomes `{ ...spanStyle, ...style }`.
3. CHANGELOG: an `Unreleased` entry describing the fix.

## Decisions (auto)

- Always pass an object for a free flag instead of `undefined` when both are empty: React renders no attribute for
  an empty style object, so the output is identical and the expression stays simple.

## Progress

- [x] Phase 1: ec45e17
