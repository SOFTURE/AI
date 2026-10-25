---
change_id: themes-page-base-718
status: done
---

# Research

- `themes/theme-kit/src/preflight.css`: Tailwind's preflight scoped to `[data-slot]`, `@layer base`, zero specificity;
  copied to `dist/` by `scripts/copy-css.mjs` (`STYLESHEETS`), exported as `./preflight.css`. Nothing styles `body`.
- `themes/theme-notion/src/sft-bridge.css` already reads the theme with `--theme()`, so it must be imported through
  the app's Tailwind; the README says so. The same holds for any new file that reads `--font-sans`, which the
  generated theme puts in `@theme inline` (not on `:root`), so `var(--font-sans)` would not resolve.
- `--background` and `--foreground` are shadcn colour roles (`SHADCN_COLOR_ROLES`), on `:root` in every theme. A
  theme without a `sans` font still has Tailwind's default `--font-sans` from `tailwindcss/theme.css`.
- `@softure-ai/ui`'s `styles.css` has no `body` rule (checked `foundation/ui/scripts/build-css.mjs` and `src/`), so a
  base-layer body rule does not fight it; its `@layer softure` sits above `base` anyway.
- With Tailwind's full preflight (`@import "tailwindcss"`), `html` gets the sans font and `body` margin 0, but no
  background or text colour, so the base rule helps both wirings.
- MapLibre: `maplibre-gl.css` sets `.maplibregl-map { font: 12px/20px Helvetica Neue, Arial, Helvetica, sans-serif }`
  unlayered. An unlayered rule beats every layered one, so the fix must be unlayered, and `body .maplibregl-map`
  (0,1,1) beats `.maplibregl-map` (0,1,0) whatever the load order. Only the family changes, size stays MapLibre's.
