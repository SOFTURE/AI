# Research: theme-notion touch-target size (issue #742)

## Current state (master 33dadbb)

- `themes/theme-notion/src/tokens.ts` defines `NOTION_THEME.sizes` (`sidebar-width`, `content-width`,
  `content-width-wide`, `control-height`, `row-height`). theme-kit's `buildThemeCss` writes each size as
  `--spacing-<name>` in the `@theme` block, so Tailwind generates `h-*`, `min-h-*`, `size-*`, `w-*` for it.
- `tests/tokens.test.ts` pins `NOTION_THEME.sizes` to the design system snapshot's `size.tokens`
  (`tests/fixtures/notion-tokens.json`); a new size goes into both.
- `tests/theme-css.test.ts` builds `theme.css` and checks utilities that the package's components use
  (`.min-h-row-height`, `.h-control-height`). A token no component uses only reaches an app's CSS when the app uses
  the class itself, which Tailwind scans in the app's sources: the `@theme` variable is always emitted.
- README "Spacing on a 4 px grid … Sizes:" lists the sizes; CHANGELOG has an `Unreleased` section.

## Findings

- One entry in `sizes` plus the snapshot gives `--spacing-touch-target: 44px` and the utilities; nothing else in
  the kit changes. 44 px is on the 4 px grid (`space-11`).
