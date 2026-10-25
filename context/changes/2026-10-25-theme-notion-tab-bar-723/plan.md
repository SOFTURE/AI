# Plan: theme-notion TabBar (issue #723)

## Phase 1: TabBar

Files: `themes/theme-notion/src/notion/TabBar.tsx`, `src/index.ts`, `tests/notion/TabBar.test.tsx`, `README.md`,
`CHANGELOG.md` (Unreleased).

1. `TabBar` with the issue's API and the reference markup, classes unchanged.
2. Export `TabBar`, `TabBarItem`, `TabBarProps` from the root.
3. Tests: exact markup of one tab, `aria-current="page"` only on the current tab, the count drawn only when given
   (0 included), the icon before the label, the root export.
4. README component list and CHANGELOG entry.

## Decisions (auto)

- No `linkComponent` prop: the adopting app uses `<a>`, and an optional prop can come later as a minor addition.
- A composition under `src/notion/`, not `src/ui/` (that folder is the shadcn set and its count is tested).
- No version bump: the coordinator releases in a batch.

## Progress

- [ ] Phase 1: TabBar
