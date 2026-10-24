# @softure-ai/theme-kit

What every SOFTURE theme package shares. A theme is plain shadcn/ui (Radix, Tailwind CSS v4, lucide icons) with its
own tokens and component deltas; the kit holds the parts that do not change from theme to theme. Apps install a theme
package (e.g. [`@softure-ai/theme-notion`](../theme-notion/README.md)), which depends on the kit; an app imports the
kit directly only for `preflight.css` or `useIsMobile`.

## What it holds

| Export | What it does |
| --- | --- |
| `ThemeDefinition` | A theme as data: colours (light and dark, or an alias of another colour), shadows, fonts, named text styles, radii, layout sizes, whether Tailwind's default palette is cleared |
| `SHADCN_COLOR_ROLES`, `findMissingColorRoles(definition)` | The colour roles shadcn/ui components read; every theme defines them, so a component moves between themes |
| `buildThemeCss(definition)` | The theme's CSS for Tailwind CSS v4 (below) |
| `createCn(options)`, `createThemeCn(definition)` | shadcn/ui's `cn`, with tailwind-merge told the theme's named text styles and shadows (`text-body` and `text-muted-foreground` both stay) |
| `useIsMobile()`, `MOBILE_BREAKPOINT` (`/react`) | The sidebar's breakpoint (768 px), on `useSyncExternalStore`; the server renders the desktop layout |
| `preflight.css` | Tailwind's preflight scoped to `[data-slot]` elements, in `@layer base` with zero specificity, plus `prefers-reduced-motion` |

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

## Adding a theme

1. Copy `themes/theme-notion/` to `themes/theme-<name>/` (the folder name gives `@softure-ai/theme-<name>`).
2. Replace `src/tokens.ts` with the theme's `ThemeDefinition` and its snapshot in `tests/fixtures/`; keep
   `findMissingColorRoles(theme)` empty.
3. Give the components the theme's deltas (sizes, radii, shadows, variants) and list them in the README; keep shadcn's
   file names and formatting, so a later `npx shadcn@latest add` diff stays readable.
4. Keep `scripts/build-css.mjs`: it writes `theme.css` from the definition with the components as `@source`.
