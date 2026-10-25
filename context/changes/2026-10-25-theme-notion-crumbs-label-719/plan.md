---
change_id: theme-notion-crumbs-label-719
status: in_progress
---

# Plan: PageHeader breadcrumb label (issue #719)

Input: change.md, research.md. Complexity: trivial (one prop, tests, README and changelog lines).

## Phase 1: crumbsLabel (TDD)

Files: `themes/theme-notion/src/notion/PageHeader.tsx`, `themes/theme-notion/tests/notion/PageHeader.test.tsx`,
`themes/theme-notion/README.md`, `themes/theme-notion/CHANGELOG.md`.

1. Test first: `PageHeader` with crumbs and `crumbsLabel="Path"` renders `aria-label="Path"` on the breadcrumb `nav`;
   without it the `nav` keeps `aria-label="breadcrumb"` (the built-in copy).
2. Add `crumbsLabel?: string` to `PageHeaderProps`, passed to `Breadcrumb` only when set.
3. README "Copy": add `PageHeader crumbsLabel`. CHANGELOG: an `Unreleased` entry.

## Decisions (auto)

- Prop name `crumbsLabel` (pairs with `crumbs`, the issue's first proposal).
- Pass `aria-label` only when set, so the default stays defined once in `Breadcrumb`.

## Progress

- [ ] Phase 1
