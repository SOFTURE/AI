# Plan: mcp-access-token-manager-sections

## Steps

1. `TokenManagerSection` type, `TOKEN_MANAGER_SECTIONS` constant, optional `sections` prop in
   `modules/mcp-access/src/ui/token-manager.tsx`; exported from `src/ui/index.ts`.
2. Tests `modules/mcp-access/tests/token-manager-sections.test.tsx`: default shows all in order; each section alone;
   order kept whatever the names' order; empty list shows nothing; a named section without data stays hidden.
3. README (composition with tabs) and CHANGELOG; patch release 0.7.2 (`npm run release:version`); the existing
   dependents' ranges accept it.

## Done when

- The new tests and the existing `token-manager.test.tsx` pass; lint and the language gate are clean.
- CI green on the pull request; `auto-release.yml` publishes `mcp-access@0.7.2`.

## Progress

- [x] 1. sections prop (6248eb6)
- [x] 2. tests: `npx vitest run modules/mcp-access/tests/token-manager` → 3 files, 37 tests passed
- [x] 3. docs and version 0.7.2 (b7ee1d5)

## Decisions (auto)

- Patch, not minor: the prop is optional and additive, and a minor bump would force widening `agent-ready`'s range.
- A `sections` filter on the existing component rather than exporting each section component: one public name, the
  section internals stay private.
