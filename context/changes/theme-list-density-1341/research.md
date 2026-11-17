# Research: list density (#1341)

## Today

- `themes/theme-kit/src/theme-definition.ts`: `ThemeDefinition` (colours, shadows, fonts, text styles, radii, sizes,
  `clearDefaultPalette`); `buildThemeCss` writes scheme blocks and an `@theme inline` block; `checkTheme` refuses
  non-kebab names and unsafe values (`UNSAFE_VALUE`).
- `themes/theme-notion`: no density concept. Lists in the components: `ItemGroup`/`Item` (shadcn, parity-tested),
  `Table`, `FoldRow`, `Timeline` (own `compact` entry size, unrelated), `Steps`.
- The adopting app's version: `divide-y divide-border` on the list, `py-1` on each item, rows `py-1.5` → `py-2`; on a
  tinted card `divide-background`, since in the dark scheme `border` = `secondary` = `#2f2f2f`.

## Checks

- Tailwind v4 generates `divide-y-(length:--list-divider-width)` (border width from the variable, between children
  only) and `py-(--list-row-y)` (verified with `@tailwindcss/node`).
- `tests/tailwind-classes.test.ts` fails on any class in `src/notion` that generates no CSS: the new classes are
  covered by it.
- Every theme package depends on the kit `^0.1.4`; `release:version` refuses a bump a dependent range rejects.

## Risks

- Variables declared on `:root` and the attribute selector have equal specificity on `<html data-density="roomy">`:
  the roomy block is written after the compact one, so it wins there.
