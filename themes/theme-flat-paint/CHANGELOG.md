# Changelog

Newest first. Each version lists what changed for an app that uses the theme. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- `Modal` and `StandingPanel` look (#781): `page.css` adds the dialog entrances (`veil-enter`, `dialog-enter`: a
  bottom sheet on a phone, a fade up 0.75 rem from 40 rem, `side-panel-enter`: from the right; slow duration, soft
  easing, no scale, no exit), and the look maps add `MODAL_LOOK`, `STANDING_PANEL_LOOK` and `getModalLook(width)`
  (veil `bg-ink/60`, panel without shadow or transition, close button `rounded-md`, title on `text-page`). An app
  drops its own keyframes and slot classes and passes `classNames={getModalLook(width)}` to `Modal` and
  `classNames={STANDING_PANEL_LOOK}` to `StandingPanel`.
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
