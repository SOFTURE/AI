---
change_id: theme-kit-cn-spacing-860
status: archived
---

# Plan: spacing tokens in createThemeCn (issue #860)

Input: change.md, research.md. Complexity: small (one file of code, its tests, docs).

## Phase 1: sizes as spacing values (TDD)

Files: `themes/theme-kit/src/create-cn.ts`, `tests/create-cn.test.ts`.

- `CnOptions.sizes?: readonly string[]`, registered as `theme.spacing` in `extendTailwindMerge`.
- `createThemeCn` takes `Pick<ThemeDefinition, "textStyles" | "shadows"> & Partial<Pick<ThemeDefinition, "sizes">>`
  and passes `Object.keys(definition.sizes ?? {})`.
- Tests: the issue's three pairs through `createCn({ sizes })` and through `createThemeCn`, the reverse order (numeric
  after the token wins), a size next to a text style stays, a definition without `sizes` still works, and without the
  names both classes stay (the bug, pinned as tailwind-merge's default).

## Phase 2: docs

`themes/theme-kit/README.md` (exports table, the `extendTheme` note), `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- `sizes` optional in `createThemeCn`'s input: a required key would break a caller passing a hand-picked object in a
  patch release.
- No version bump: the coordinator releases (theme-kit patch).

## Progress

- [x] Phase 1: sizes as spacing values, 58b2436
- [x] Phase 2: docs, 65db0b2
- [x] Implementation review: approved
