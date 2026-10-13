---
change_id: ui-query-nav-active-454
status: planned
---

# Plan: QuerySegmentedNav outside a Next request, active view from the server (issue #454)

Input: change.md, research.md. Complexity: small (one component, tests, docs).

## Phase 1: null-safe hooks and `active` (TDD)

Files: `foundation/ui/src/next/query-segmented-nav.tsx`, `foundation/ui/tests/adoption-gaps-407-next.test.tsx`.

1. Tests first: the mock can return `null` for both hooks; the nav renders, the default item is current and the links
   are `?` and `?view=chart`; with a pathname and `null` search the links are `/plan` and `/plan?view=chart`;
   `active="chart"` marks Chart with no parameter in the URL; `active="table"` beats `view=chart` in the URL, and
   the links still keep the other parameters.
2. Implement: widen both hook results to `| null`, default the search to `""`; `current = active ?? <URL value>`;
   query-only hrefs when there is no pathname, `?` for an empty one.

## Phase 2: docs

`foundation/ui/README.md` (the `QuerySegmentedNav` paragraph names `active` and the null behaviour),
`foundation/ui/CHANGELOG.md` `## Unreleased`.

## Progress

- [x] Phase 1: null-safe hooks and `active` (`813426e`; 5 tests written first and red, one with the real `next/navigation` and `renderToStaticMarkup`, failing with the issue's `Cannot read properties of null`)
- [ ] Phase 2: docs
