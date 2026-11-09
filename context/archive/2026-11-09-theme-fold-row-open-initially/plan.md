# Plan: theme-fold-row-open-initially

## Steps

1. `src/notion/FoldRow.tsx`: optional `isOpenInitially` (default false) sets `open` on the `<details>`, with or
   without `actions`.
2. README (`FoldRow` section), CHANGELOG, version 0.16.0 (`npm run release:version`-equivalent bump in a PR).
3. Test: open with the prop, closed without it and with `false`, open inside the actions wrapper.

## Progress

- [x] 1 `FoldRow isOpenInitially`; `open={isOpenInitially || undefined}` so a closed row renders no attribute at all.
- [x] 2 README, CHANGELOG, version.
- [x] 3 `npx vitest run themes/theme-notion/tests/notion/FoldRow.test.tsx` green; typecheck and lint clean.

## Decisions (auto)

- `isOpenInitially`, not `isOpen`: the element is uncontrolled; the package already uses the name for the same idea.
- Minor bump: a new optional prop.
