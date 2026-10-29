---
change_id: theme-kit-cn-spacing-860
---

# Research: spacing tokens in createThemeCn (issue #860)

## What exists

- `themes/theme-kit/src/create-cn.ts`: `createCn({ textStyles, shadows })` extends tailwind-merge 3 with
  `theme.text` and `theme.shadow`; `createThemeCn(definition)` takes `Pick<ThemeDefinition, "textStyles" |
  "shadows">`.
- `ThemeDefinition.sizes` (`theme-definition.ts`) are emitted as `--spacing-<name>` (`build-theme-css.ts`), so
  Tailwind 4 serves them through every spacing utility (`w-`, `h-`, `size-`, `min-h-`, `p-`, `gap-`, …).
- tailwind-merge 3 has a `spacing` theme key that all those class groups read. Checked in node:
  `extendTailwindMerge({ extend: { theme: { spacing: ["row-height", "touch-target", "control-height"] } } })` gives
  `min-h-row-height`, `h-control-height`, `size-touch-target`, `w-sidebar-width` for the issue's pairs and keeps
  `text-body h-row-height`.
- Callers: `themes/theme-notion/src/lib/utils.ts` and `themes/theme-flat-paint/src/lib/utils.ts` pass the whole theme,
  so they pick the sizes up with no change.

## Options

1. A `sizes` option on `createCn`, filled by `createThemeCn` from `definition.sizes`. Chosen: same shape as text
   styles and shadows.
2. Ask apps to pass extra config: rejected, the bug is in the kit.
