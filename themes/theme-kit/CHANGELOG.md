# Changelog

Newest first. Each version lists what changed for an app or a theme package that uses the kit.

## 0.1.5

- App icon (#839): `@softure-ai/theme-kit/next` exports `drawAppIcon({ theme, icon, size, tone, scheme, shape })`, the
  `next/og` image for `app/icon.tsx` and `app/apple-icon.tsx` in any theme's colours, with `APP_ICON_SIZE` (32 × 32),
  `APPLE_ICON_SIZE` (180 × 180), `buildAppIconElement` and `renderIconSvg`. The glyph is icon data
  (`import { Wallet } from "lucide"`) or `{ svg }` markup. `next` `^16.0.0` is a new optional peer, needed only for
  `/next`. An app that draws its icon itself can replace its `icon.tsx` / `apple-icon.tsx` with the README's
  examples: add `lucide` (the same icons as lucide-react, as data) and drop the `renderToStaticMarkup` step.
- `getThemeColor(theme, name, scheme)` (#839): a colour's value in one scheme, aliases followed.

## 0.1.4

- Themes re-export the kit's stylesheets (#795): `softure-theme-css` also writes `dist/preflight.css`,
  `dist/base.css` and `dist/maplibre.css` into every theme, each one `@import "@softure-ai/theme-kit/<name>.css";`,
  and the theme contract requires the matching `exports`. `KIT_STYLESHEETS` and `buildKitStylesheetReexport` in
  `/build`; `parseThemePackageConfig` refuses a theme stylesheet named like a kit one. A theme package adds the three
  exports (`tests/repo/themes.test.ts` checks it); the kit keeps exporting its own files.

## 0.1.3

- `base.css` (#746): every element's `border-color` is the theme's `border` and its `outline-color` a half-transparent
  `ring` (shadcn/ui's `* { @apply border-border outline-ring/50; }`), in `@layer base` after Tailwind's preflight. A
  `border` without a colour class (table rows, accordion items, alerts, sheets) no longer draws in the text colour; a
  `border-*` or `outline-*` utility still wins. An app that imports `base.css` changes nothing; one that kept the
  shadcn rule in its own `globals.css` can drop it.

## 0.1.2

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
