---
change_id: themes-kit-stylesheets-795
status: archived
---

# Plan: themes ship the kit's page stylesheets as their own (issue #795)

Input: change.md, research.md. Complexity: small (kit build, two manifests, tests, docs).

## Phase 1: the contract and the build

Files: `themes/theme-kit/src/build/*`, `themes/theme-kit/tests/build.test.ts`, `tests/repo/themes.test.ts`,
`themes/theme-*/package.json`.

1. `KIT_STYLESHEETS` (`preflight.css`, `base.css`, `maplibre.css`) and `buildKitStylesheetReexport(name)` in
   `/build`; `writeThemeStylesheets` writes each into the theme's `dist/` and returns them in its file list.
2. `parseThemePackageConfig` refuses a `softureTheme.stylesheets` entry named like a kit stylesheet (it would be
   overwritten).
3. Every theme's `package.json` exports `./<name>.css` → `./dist/<name>.css` for each kit stylesheet; the repository
   test checks it for every theme.
4. Tests: the build writes the three re-exports with exact text; the refusal; a Tailwind CLI compile of an app that
   imports `@softure-ai/theme-x/base.css` where the kit sits only in the theme's nested `node_modules` (strict
   layout) yields the kit's rules.

## Phase 2: docs

Files: READMEs and CHANGELOGs of theme-kit, theme-notion, theme-flat-paint; comments in the themes' `page.css`.

1. Setup blocks import `@softure-ai/theme-<name>/{preflight,base,maplibre}.css`; the kit README says apps import
   the stylesheets through their theme, and adds the re-exports to the contract.
2. CHANGELOGs `Unreleased`: the new exports and the migration line for apps (replace `@softure-ai/theme-kit/` with
   `@softure-ai/theme-<name>/` in `globals.css`; drop a direct theme-kit dependency kept only for CSS).

## Decisions (auto)

- Re-export, not inline (research, option 1): the theme's dependency range decides the kit version.
- All three kit stylesheets, one mechanism, not only `base.css`.
- The kit keeps its own `./*.css` exports: existing apps keep working, a theme's re-export imports them.
- No visual change: the NOTION · Design System artifact builds from the kit's `src/base.css`, whose rules do not
  change; nothing to sync.

## Progress

- [x] Phase 1: the contract and the build (fd5ebce, kit and repo theme tests 58/58)
- [x] Phase 2: docs (6a0d421)
