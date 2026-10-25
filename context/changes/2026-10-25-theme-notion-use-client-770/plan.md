# Plan: theme-notion "use client" in item.tsx (issue #770)

## Phase 1: the directive and the guard

Files: `themes/theme-notion/src/ui/item.tsx`, `tests/repo/themes.test.ts`, `themes/theme-kit/README.md` (contract),
`themes/theme-notion/CHANGELOG.md` (Unreleased).

1. Test first: a contract case in `tests/repo/themes.test.ts`, run per theme package: list the source files that call
   `createContext` (any `.ts`/`.tsx`) or a hook (`use[A-Z]…(` in a `.tsx`) and do not start with `"use client"`;
   expect an empty list. It fails on `item.tsx` before the fix.
2. Add `"use client"` as the first line of `item.tsx`.
3. Theme contract in the kit README: a new rule that a component file with a context or a hook is a client module,
   so the package root stays importable from Server Components.
4. CHANGELOG `## Unreleased`: the fix and that an app on 0.2.0 can move to the next patch without changes.

## Decisions (auto)

- Static guard only, no `react-server` smoke test: see research (Node evaluates client modules, so the smoke test
  would fail on Radix regardless of the theme).
- `.ts` hook modules (`use-is-mobile.ts`) are allowed: defining a hook runs nothing at import.
- The guard lives in the generic theme contract test, not in theme-notion's own tests, so theme-flat-paint and later
  themes are covered.
- No version bump: the coordinator releases 0.3.1.

## Progress

- [ ] Phase 1: the directive and the guard
