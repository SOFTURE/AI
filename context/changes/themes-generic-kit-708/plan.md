---
change_id: themes-generic-kit-708
status: in_progress
---

# Plan: a generic theme contract (issue #708)

Input: change.md, research.md. Complexity: medium (kit API and a command, Notion moved onto it, one repo test).

## Phase 1: kit API

Files: `themes/theme-kit/src/{check-theme,define-theme,extend-theme,build-theme-css,index}.ts`, tests.

1. `checkTheme(definition): string[]`: missing shadcn roles, non-kebab names, unsafe values, dangling aliases.
   `buildThemeCss` keeps its throws (same messages).
2. `defineTheme<const T extends ThemeDefinition>(definition: T): T`: throws with every problem listed.
3. `extendTheme(base, overrides)`: a new name, each token group merged over the base's, the result checked.

## Phase 2: stylesheet builder and command

Files: `themes/theme-kit/src/build/*`, `src/cli/bin.ts`, `package.json` (`./build`, bin `softure-theme-css`).

1. `ThemePackageConfig` (`sources`, `imports`, `stylesheets`) and `parseThemePackageConfig(unknown)` (result value).
2. `buildThemeStylesheet({ theme, sources, imports })`, `writeThemeStylesheets({ packageDir, distDir, theme, config })`.
3. `softure-theme-css [packageDir]`: reads `softureTheme` from `package.json`, the `theme` export of
   `dist/tokens.js`, writes `dist/theme.css`, copies the stylesheets from `src/`.

## Phase 3: Notion on the contract, repo test, docs

1. `tokens.ts` exports `theme = defineTheme(...)` and `NOTION_THEME`; index exports both; `package.json` gets
   `softureTheme` and `"build": "tsc -p tsconfig.build.json && softure-theme-css"`; `scripts/build-css.mjs` goes.
2. `tests/repo/themes.test.ts`: every `themes/theme-*` except the kit depends on the kit, exports `./theme.css`, has a
   valid `softureTheme` whose folders and files exist, builds with `softure-theme-css`, and its `theme` passes
   `checkTheme`; its `cn` is exported.
3. Kit README: the design (contract, lifecycle, overriding in an app, adding a theme); Notion README and CHANGELOGs.

## Decisions (auto)

- Config in `package.json` rather than a per-theme script: data, checkable by the repo test, no code to copy.
- The standard export name is `theme` (with `NOTION_THEME` kept): an app swaps themes by the import path only.
- `extendTheme` merges one level deep per token group; deeper merging would hide which value wins.

## Progress

- [ ] Phase 1: kit API
- [ ] Phase 2: stylesheet builder and command
- [ ] Phase 3: Notion on the contract, repo test, docs
