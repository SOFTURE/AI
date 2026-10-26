# @softure-ai/theme-kit

The standard every SOFTURE theme package is built on. A theme is plain shadcn/ui (Radix, Tailwind CSS v4, lucide
icons) with its own tokens and component deltas; the kit holds everything that does not change from theme to theme:
the token contract, the way a theme is declared, the CSS generator, the build command and the shared helpers. A new
theme is a new `themes/theme-<name>` folder that follows the contract below; nothing in the kit changes.

Apps install a theme package (e.g. [`@softure-ai/theme-notion`](../theme-notion/README.md)), which depends on the kit.
An app imports the kit directly only for its stylesheets (`preflight.css`, `base.css`, `maplibre.css`), `useIsMobile`,
or to build its own variant of a theme.

## Design

```text
ThemeDefinition (data)  ──defineTheme──▶  theme (checked)  ──buildThemeCss──▶  tokens CSS
        ▲                                     │
   extendTheme(base, overrides)               └──softure-theme-css + softureTheme──▶  dist/theme.css
```

- **One contract.** `ThemeDefinition` says what a theme decides: colours (light and dark, or an alias of another
  colour), shadows, fonts, named text styles, radii, layout sizes, whether Tailwind's default palette is cleared.
  `SHADCN_COLOR_ROLES` are the colour roles shadcn/ui components read; every theme defines them all, so a component
  written for one theme renders in any other. A theme adds its own tokens on top (`green-tag`, `primary-hover`).
- **Declared and checked in one place.** `defineTheme(definition)` checks the theme where it is written and throws
  with every problem listed: a missing colour role, a name that is not kebab-case, an empty value or one that could
  break out of the CSS, an alias of a colour the theme does not define. `checkTheme` returns the same problems as a
  list. The literal types stay, so `theme.colors.primary` is known to the compiler.
- **Built the same way.** A theme package has no build script of its own. It declares its stylesheet as data
  (`softureTheme` in `package.json`) and its build runs the kit's `softure-theme-css`, which writes `dist/theme.css`
  from the package's `theme` and copies its extra stylesheets.
- **Variants, not copies.** `extendTheme(base, overrides)` gives a theme that differs from another in a few tokens:
  each token group of the overrides is laid over the base's (a token is replaced whole), the result is checked.
- **Checked in the repository.** `tests/repo/themes.test.ts` runs the contract over every `themes/theme-*` package,
  so a new theme is covered by being created.

## What it holds

| Export | What it does |
| --- | --- |
| `ThemeDefinition`, `SHADCN_COLOR_ROLES`, `findMissingColorRoles` | The token contract |
| `defineTheme(definition)` | Declares a theme: checks it, returns it with its literal types, throws with every problem |
| `checkTheme(definition)` | The contract problems as messages; empty when the theme is complete |
| `extendTheme(base, overrides)` | A checked variant of a theme: a new name, per group only the tokens that change |
| `buildThemeCss(definition)` | The theme's tokens as CSS for Tailwind CSS v4 (below) |
| `createCn(options)`, `createThemeCn(definition)` | shadcn/ui's `cn`, with tailwind-merge told the theme's named text styles and shadows (`text-body` and `text-muted-foreground` both stay) |
| `useIsMobile()`, `MOBILE_BREAKPOINT` (`/react`) | The sidebar's breakpoint (768 px), on `useSyncExternalStore`; the server renders the desktop layout |
| `preflight.css` | Tailwind's preflight scoped to `[data-slot]` elements, in `@layer base` with zero specificity, plus `prefers-reduced-motion` |
| `base.css` | The page base: `body` without the browser's margin, on the theme's `background`, `foreground` and sans font (Radix portals on `body` inherit it); a `border` without a colour class in the theme's `border` and outlines in a half-transparent `ring`, as shadcn/ui's `globals.css` does, where Tailwind's preflight leaves `currentColor`; all in `@layer base` |
| `maplibre.css` | The theme's sans font on MapLibre maps (`body .maplibregl-map`, unlayered, so it beats `maplibre-gl.css` in any load order) |
| `softure-theme-css [packageDir]` | Builds a theme package's stylesheets after `tsc` (the contract below) |
| `/build`: `parseThemePackageConfig`, `buildThemeStylesheet`, `writeThemeStylesheets`, `buildThemePackage` | The code behind the command, for tests and tools (Node only) |

`base.css` and `maplibre.css` read the font with `--theme()`, so they are imported through the app's Tailwind, after
the theme's `theme.css`. They read only contract tokens, so they work with every theme.

## The theme package contract

Every `themes/theme-<name>` package (named `@softure-ai/theme-<name>` by its folder):

1. `src/tokens.ts` exports `theme`, declared with `defineTheme`. It may also export a named alias (`NOTION_THEME`).
2. `src/index.ts` exports `theme`, `cn` (`createThemeCn(theme)`) and the components. The same names in every theme,
   so an app moves to another theme by changing the import path.
3. `package.json`:
   - depends on `@softure-ai/theme-kit`; takes `react` and `tailwindcss` `^4.0.0` as peers;
   - `"build": "tsc -p tsconfig.build.json && softure-theme-css"`;
   - exports `./theme.css` (`./dist/theme.css`) and each extra stylesheet (`./<name>.css` → `./dist/<name>.css`);
   - declares the stylesheet:

     ```json
     "softureTheme": {
       "sources": ["./ui", "./notion"],
       "imports": ["tw-animate-css"],
       "stylesheets": ["sft-bridge.css"]
     }
     ```

     `sources`: the component folders under `src/` (and `dist/`), written into `theme.css` as `@source`, so the app's
     Tailwind generates their classes inside `node_modules`. `imports`: CSS packages the components need, imported
     first. `stylesheets`: plain CSS files in `src/` copied to `dist/` as they are. Each defaults to none.

4. A component file that creates a React context or calls a hook starts with `"use client"` (as does any source file
   that calls `createContext`), so the package root stays importable from a Server Component. Plain `.ts` modules that
   only define a hook (`useIsMobile`) need no directive.

`theme.css` is then `@import` lines, `@source` lines and the generated tokens, in that order.

## The generated CSS

`buildThemeCss` writes, in this order:

1. `@custom-variant dark`: Tailwind's `dark:` follows the same rule as the tokens below.
2. `:root, .light, [data-theme="light"]`: the light values.
3. `@media (prefers-color-scheme: dark)` → `:root:not(.light, [data-theme="light"])`: the dark values by the system
   setting, unless the page asks for light.
4. `.dark, [data-theme="dark"]`: the dark values by choice. Works with `next-themes` (`attribute="class"`) and with
   `@softure-ai/ui`'s `ThemeScript` / `ThemeSwitch` (`data-theme` on `<html>`); a section can take a fixed scheme.
5. `@theme inline`: `--color-<name>`, `--font-*`, `--text-<style>` (size, line height, weight, tracking),
   `--radius-*`, `--shadow-*` and the sizes as `--spacing-*`, so `bg-primary`, `text-page-title`, `rounded-xl`,
   `shadow-menu` and `w-sidebar-width` exist. With `clearDefaultPalette`, `--color-*: initial` first.

It throws on a name that is not kebab-case, a value holding `;`, `{`, `}`, `<`, `>` or a line break, and an alias of
a colour the theme does not define.

## Overriding in an app

- **A few tokens:** redefine the CSS variables after the theme's `theme.css`, for both schemes:

  ```css
  @import "@softure-ai/theme-notion/theme.css";
  :root { --primary: #e16259; }
  .dark, [data-theme="dark"] { --primary: #df5452; }
  ```

- **A variant of its own:** build it from the theme and write the CSS in the app's build, then import the app's file
  instead of the theme's tokens:

  ```ts
  import { writeFileSync } from "node:fs";
  import { buildThemeCss, extendTheme } from "@softure-ai/theme-kit";
  import { theme } from "@softure-ai/theme-notion";

  const brand = extendTheme(theme, { name: "Brand", colors: { primary: { light: "#e16259", dark: "#df5452" } } });
  writeFileSync("app/brand-theme.css", buildThemeCss(brand));
  ```

  `cn` stays the theme's while the variant adds no text styles or shadows; otherwise use `createThemeCn(brand)`.

## Adding a theme

1. Create `themes/theme-<name>/` with the workspace package shape (`templates/package/` for `package.json`, the
   `tsconfig` files and `CHANGELOG.md`) and the contract above.
2. `src/tokens.ts`: `export const theme = defineTheme({ name: "<Name>", colors: { … }, … })`. Every shadcn colour
   role is required; `defineTheme` names the missing ones. A theme close to an existing one can be
   `extendTheme(otherTheme, { … })`. Keep a snapshot of the design system's tokens in `tests/fixtures/` and a test
   that the definition equals it.
3. `src/lib/utils.ts`: `export const cn = createThemeCn(theme)`.
4. `src/ui/`: the shadcn/ui components with the theme's deltas (sizes, radii, shadows, variants), listed in the
   README; keep shadcn's file names and formatting, so a later `npx shadcn@latest add` diff stays readable. Add
   compositions in a folder of their own and name every folder in `softureTheme.sources`.
5. Run `npm test`: `tests/repo/themes.test.ts` checks the package against the contract.
