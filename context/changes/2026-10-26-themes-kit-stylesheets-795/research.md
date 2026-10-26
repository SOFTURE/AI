---
change_id: themes-kit-stylesheets-795
---

# Research

## How the stylesheets ship today

- `themes/theme-kit/package.json` exports `./preflight.css`, `./base.css`, `./maplibre.css` (copied from `src/` by
  `scripts/copy-css.mjs`). `base.css` and `maplibre.css` read `--theme(--font-sans)`, so they go through the app's
  Tailwind; `preflight.css` is plain CSS.
- A theme's stylesheets are built by `softure-theme-css` (`src/build/theme-stylesheet.ts`, `writeThemeStylesheets`):
  `dist/theme.css` generated, the `softureTheme.stylesheets` copied from `src/`. Nothing from the kit is re-exported.
- READMEs: theme-flat-paint (setup block) imports `@softure-ai/theme-kit/base.css`; theme-notion imports
  `@softure-ai/theme-kit/base.css`, `maplibre.css` and, in the scoped-preflight variant, `preflight.css`.
  theme-kit's README says "an app imports the kit directly only for its stylesheets".
- `tests/repo/themes.test.ts` runs the theme contract over every `themes/theme-*` package (exports, build script,
  `softureTheme`).

## How a re-export resolves

- Tailwind CSS v4 (`@tailwindcss/node`) inlines `@import` and resolves a bare specifier from the folder of the file
  that holds it (enhanced-resolve, `style` condition, then `exports`). A file in
  `node_modules/@softure-ai/theme-x/dist/` therefore finds `@softure-ai/theme-kit` the way Node does from the theme:
  its own nested `node_modules` first (pnpm's symlinked layout, a nested second version), then the hoisted one.
- postcss-import and webpack's css-loader resolve bare `@import` the same way, so `preflight.css` (no `--theme()`)
  also works outside Tailwind.

## Options

1. Re-export (`@import "@softure-ai/theme-kit/<name>.css";` in `dist/<name>.css` of the theme). The theme's own
   dependency range decides the version; a kit patch reaches apps without a theme release. Chosen.
2. Inline the kit's CSS into the theme's `dist/` at build time. No resolution at all, but a kit fix then needs a
   theme rebuild and release, and the bytes would drift from the declared range. Rejected.
3. Peer dependency plus README note (issue option 2). Keeps two packages on the app's surface. Rejected by the issue.

## Scope

All three kit stylesheets, not only `base.css`: `preflight.css` and `maplibre.css` have the same transitive-import
gap, and doing it in the contract makes it one mechanism for all.
