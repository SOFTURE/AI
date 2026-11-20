# Plan: theme-notion-tabbar-touch

## Approach
Add `size` and `tabClassName` to `TabBar`, merged with `cn` after the link's base classes.

## Phases
### Phase 1: TabBar touch size (TDD)
- `themes/theme-notion/src/notion/TabBar.tsx`, `tests/notion/TabBar.test.tsx`, README, CHANGELOG, version 0.29.0.
- Done when: the package tests, typecheck and lint pass.

## Progress
- [x] Phase 1: TabBar touch size (`npx vitest run themes/theme-notion/tests`: 67 files, 1308 tests passed; `tsc` and
  `eslint` clean on the package).
