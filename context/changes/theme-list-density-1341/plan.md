# Plan: list density (#1341)

## Approach

The kit defines the density contract and writes the variables into every theme's CSS; theme-notion adds three list
primitives that read them.

## Phases

### Phase 1: kit contract (test-first)

- Tests in `themes/theme-kit/tests/build-theme-css.test.ts` and `check-theme.test.ts`: the default scale on
  `:root, [data-density="compact"]` and `[data-density="roomy"]` (roomy after compact); a theme's own scale replaces
  it; an unsafe or empty density value is refused by `checkTheme` and `buildThemeCss`; `DENSITIES` lists both.
- `src/density.ts` (`DENSITIES`, `Density`, `DensityScale`, `DEFAULT_DENSITY`, `LIST_DENSITY_VARIABLES`),
  `ThemeDefinition.density?`, `checkTheme`, `buildThemeCss`, `index.ts`; README; CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-kit` and every theme's `theme-css` tests pass.

### Phase 2: theme-notion components (test-first)

- `tests/notion/List.test.tsx`: `List` renders `ul` (or `ol`) with `data-slot="list"`, the divider width variable and
  `divide-border`, `divide-background` with `surface="tinted"`; `ListItem` an `li` with the item variable, `asChild`
  keeps the child element; `ListRow` a `div` by default, `asChild` a button keeps its own element and role; classes
  merge.
- `src/notion/List.tsx`, `src/index.ts`; gallery entry and inventory if the tests ask for one;
  README section "List density"; CHANGELOG.
- Done when: `npx vitest run themes/theme-notion` passes, typecheck and lint pass.

### Phase 3: versions

- `npm run release:version -- theme-kit patch` (0.1.10), then the kit range in theme-notion `^0.1.10`, then `theme-notion minor` (0.23.0); drop the local tags.
- Done when: both `package.json` and CHANGELOG headings carry the versions.

## Progress

- [x] Phase 1: kit contract (cda4458)
- [x] Phase 2: theme-notion components (763a693)
- [ ] Phase 3: versions
