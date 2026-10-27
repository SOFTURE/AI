# Changelog

Newest first. Each version lists what changed for an app that uses the theme. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## 0.2.0

- Needs `@softure-ai/theme-kit` `^0.1.4` (was `^0.1.2`): the version whose `softure-theme-css` writes `preflight.css`
  and the stylesheet re-exports (#795).
- Look maps for five more ui components (#782): `HINT_LOOK` (spread on `Hint`: 10 px glyph, `accent` focus ring,
  6 px bubble, 8 px gap), `CHECKLIST_LOOK` (hairline list, `accessible` done marker, struck-through done label),
  `STEPPER_LOOK` (32/40 px markers per state, label for screen readers only on phones), `MENU_PANEL_LOOK` (ghost
  trigger, flat panel with an opacity and scale entrance; for `DisclosureMenu`, `AccountMenu` and `MobileMenu`) and
  `COLOR_FIELD_LOOK` (square presets framed when picked, a 28 × 36 px native picker). An app that carries these
  class strings itself replaces them with the maps, e.g. `<Checklist classNames={CHECKLIST_LOOK} …>`; one that
  merges its own classes in passes `cn(CHECKLIST_LOOK.row, …)`.
- `base.css`, `preflight.css`, `maplibre.css` (#795): the kit's page stylesheets, exported by the theme as
  `@softure-ai/theme-flat-paint/<name>.css`. Each is one `@import` of the kit's file, resolved from the theme's own dependency,
  so the app gets the kit version the theme was built against and needs no `@softure-ai/theme-kit` of its own. An app
  replaces `@softure-ai/theme-kit/` with `@softure-ai/theme-flat-paint/` in its `globals.css` and drops a direct
  `@softure-ai/theme-kit` dependency it kept only for the CSS. The old imports keep working while the kit is hoisted.
- `Modal` and `StandingPanel` look (#781): `page.css` adds the dialog entrances (`veil-enter`, `dialog-enter`: a
  bottom sheet on a phone, a fade up 0.75 rem from 40 rem, `side-panel-enter`: from the right; slow duration, soft
  easing, no scale, no exit), and the look maps add `MODAL_LOOK`, `STANDING_PANEL_LOOK` and `getModalLook(width)`
  (veil `bg-ink/60`, panel without shadow or transition, close button `rounded-md`, title on `text-page`). An app
  drops its own keyframes and slot classes and passes `classNames={getModalLook(width)}` to `Modal` and
  `classNames={STANDING_PANEL_LOOK}` to `StandingPanel`.
- `RADIO_LOOK`, `CHOICE_ROW_LOOK` and `CHOICE_CARD_LOOK` (#794): one look for a single-choice radio list. The checked
  radio is a lime disc with an `accent` line and a black check (as the checkbox and the switch knob); the row marks
  the checked choice with a wash and the 3 px lime bar (`shadow-selected-row`), the card with a doubled foreground
  line; keyboard focus is an `accent` outline on the label; the title turns bold when checked. An app replaces its
  hand-written row and card classes with the slots (markup in the README); the row's accent ring becomes the disc.
- `SEGMENTED_CONTROL_LOOK` and `THEME_SWITCH_LOOK` (#780): ready slot maps for ui's `SegmentedControl` and
  `ThemeSwitch` with `unstyled`; the checked segment is surface, strong line and bold (never lime, which fails WCAG
  1.4.11 on white), focus is a 2 px accent outline, the legend is visually hidden. `SEGMENT_ACTIVE_WHEN_CHECKED_LOOK`
  is the active segment as `has-checked:` variants. An app replaces its own two slot maps with
  `<SegmentedControl unstyled classNames={SEGMENTED_CONTROL_LOOK} … />` and
  `<ThemeSwitch unstyled classNames={THEME_SWITCH_LOOK} />`.
- `DATA_TABLE_LOOK` (#784): the design system's data table as slots for an app's own `<table>` (header cell, row,
  text cell, amount cell, empty cell, selected row with the lime bar, sticky column with its hairline below `xl`). An
  app that wrote these rules itself replaces them with the slots.
- `page.css` gains `.shot-frame` (#784): an image framed as the product (card radius, the `--shadow-shot-frame`
  hairline, `object-fit: cover` from the top, `paper` behind a lazy image). An app that wrote
  `box-shadow: 0 0 0 1px var(--paper-line)` by hand uses the class instead and keeps its own aspect ratio.
- The look of the `@softure-ai/charts` primitives (#779), in `look/chart.ts`: `CHART_FLAG_VARIANT_LOOK` (`accent`,
  `deep`), `CHART_FLAG_SIZE_LOOK` and `getChartFlagLook` for `ChartFlag`; `CHART_PIN_LOOK` (dot fill and size, the
  ring per chart surface, the event line per surface) for `ChartPin`; `CHART_ROLE_TONE`, the charts tone of each role.
  An app that passed `border-l border-dashed border-chart-axis/60` to the pin line drops it: that border drew a second
  dash next to the package's; `CHART_PIN_LOOK.line` colours the package's own dash instead.

## 0.1.1

- No change to the package itself: the first version published through the npm trusted publisher (OIDC) with
  provenance, without a token.

## 0.1.0

- First version (#765): `FLAT_PAINT_THEME` (the Flat Paint design system's tokens, pinned to its snapshot, with the
  shadcn colour roles as aliases), `theme.css` (tokens, Tailwind utilities, `dark:` on the theme's scheme rule, the
  look maps as Tailwind sources), `sft-bridge.css` (the `--sft-*` tokens of `@softure-ai/ui` on the theme's roles in
  every scheme scope), `page.css` (colour scheme, body tracking, placeholder and selection, the `figure`, `num`,
  `tabular` and `card-surface` classes, motion durations and easings, reduced motion), the look maps of the ui
  components (button, icon button, card, stat, field label, switch, checkbox, segmented control), `ROLE_TONE` and `cn`.
