# Plan: theme-notion-switch-touch

## Approach
Add `size="touch"` to `Switch`: root and thumb classes merged with `cn` after the base classes, so the touch classes
replace the base track colours and thumb moves.

## Phases
### Phase 1: Switch touch size (TDD)
- `themes/theme-notion/src/ui/switch.tsx`, `tests/upstream/deltas.ts`, `tests/behaviour/controls.test.tsx`, README,
  CHANGELOG, version 0.30.0.
- Done when: the package tests, typecheck and lint pass.

## Progress
- [x] Phase 1: Switch touch size (`npx vitest run themes/theme-notion`: all files passed; `tsc` and `eslint` clean on
  the package).
