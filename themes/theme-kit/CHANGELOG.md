# Changelog

Newest first. Each version lists what changed for an app or a theme package that uses the kit.

## Unreleased

- `base.css` (#718): the page base for an app on the scoped `preflight.css`: `body` without the browser's margin, on
  the theme's `background`, `foreground` and sans font, in `@layer base`. Radix portals on `body` inherit it.
- `maplibre.css` (#718): the theme's sans font on MapLibre maps, unlayered and more specific than `maplibre-gl.css`,
  so it wins in any load order.
- Both read only contract tokens and go through the app's Tailwind (`--theme()`), after the theme's `theme.css`.

## 0.1.1

- No change to the package itself: the first version published through the npm trusted publisher (OIDC) with
  provenance, without a token.

## 0.1.0

- First version: `ThemeDefinition` and `SHADCN_COLOR_ROLES` (the token contract), `buildThemeCss` (tokens on
  `:root`, dark by the system setting and by `.dark` / `[data-theme]`, the Tailwind `@theme inline` block),
  `findMissingColorRoles`, `createCn` and `createThemeCn`, `useIsMobile` (`./react`) and `preflight.css` (#708).
- The theme package contract (#708): `defineTheme` (checks a theme where it is declared), `checkTheme` (the problems
  as a list), `extendTheme` (a variant of an existing theme), the `softure-theme-css` command that builds every theme
  package's `theme.css` from `softureTheme` in its `package.json`, and `./build` (`parseThemePackageConfig`,
  `buildThemeStylesheet`, `writeThemeStylesheets`, `buildThemePackage`).
