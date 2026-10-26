---
change_id: theme-flat-paint-chart-look
status: archived
---

# Plan: chart look maps (issue #779)

Input: change.md, research.md. Complexity: small (one new look file, no change to other packages).

## Phase 1: look maps, tests, docs

Files: `themes/theme-flat-paint/src/look/chart.ts`, `src/index.ts`, `tests/index.test.ts`,
`tests/contrast.test.ts`, `tests/theme-css.test.ts`, `README.md`, `CHANGELOG.md`.

1. `look/chart.ts`:
   - `CHART_FLAG_VARIANT_LOOK` by `ChartFlagLook` (`accent`: `bg-accent-fill text-on-accent`; `deep`:
     `bg-lime-deep text-paper`), for `ChartFlag variant="flag"`;
   - `CHART_FLAG_SIZE_LOOK` by `ChartFlagSize` (`md`: `rounded-md px-2 py-1 text-xs`; `sm`:
     `rounded-flag px-1.5 py-0.5 text-[0.6875rem]`), each with `whitespace-nowrap font-bold tabular-nums`;
   - `getChartFlagLook(look, size)` joining both, as `getIconButtonLook`;
   - `CHART_PIN_LOOK`: `dot` by `ChartPinVariant` (`flag` `bg-lime`, `ink` `bg-lime-deep`), `size` by
     `ChartPinSize` (`sm` `size-2.5`, `md` `size-3`, `lg` `size-4`), `ring` by `ChartSurfaceName` (`page`
     `border-foreground`, `dark` `border-ink`, `paper` `border-paper`), `line` by `ChartSurfaceName` (the package's
     dash coloured through `--sft-chart-pin-line`: axis at 60 %, 70 % on paper);
   - `CHART_ROLE_TONE`: `accessible success`, `locked warning`, `debt danger`, `accent accent`, `muted muted`.
2. Barrel exports; index test for the helper and the tone map; theme CSS test that the classes are generated;
   contrast test for `on-accent` on `accent-fill` and `paper` on `lime-deep`.
3. README look maps table and a charts example; CHANGELOG `Unreleased`.

## Decisions (auto)

- The pin line sets `--sft-chart-pin-line` instead of `border-l border-dashed`: charts draws its own dash, so a
  border would draw a second line (R1). Same colour and alpha as the issue's values.
- The axis colour is read as `var(--sft-chart-axis)` (the bridge's chart axis), not a `chart-axis` utility the theme
  does not define (R2), so an app retuning the axis per surface moves the pin line with it.
- The flag's variant keys are the theme's own (`accent`, `deep`), passed with charts' `variant="flag"`: charts has no
  deep variant, and the theme does not add one to charts.
- `sm` flag radius is `rounded-flag` (the design system's 4 px `radius-flag`), the value the issue's `rounded` has.
- `lg` pin dot is `size-4`: the design system names only `md` and `sm`; 16 px keeps charts' 1.25x step rounded up.
- Local types for the charts prop values, no dependency on `@softure-ai/charts` (as for ui).

## Progress

- [x] Phase 1: look maps, tests, docs (f6eac8b, theme tests 45/45)
