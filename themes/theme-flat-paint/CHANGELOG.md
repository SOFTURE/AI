# Changelog

Newest first. Each version lists what changed for an app that uses the theme. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- Look maps for five more ui components (#782): `HINT_LOOK` (spread on `Hint`: 10 px glyph, `accent` focus ring,
  6 px bubble, 8 px gap), `CHECKLIST_LOOK` (hairline list, `accessible` done marker, struck-through done label),
  `STEPPER_LOOK` (32/40 px markers per state, label for screen readers only on phones), `MENU_PANEL_LOOK` (ghost
  trigger, flat panel with an opacity and scale entrance; for `DisclosureMenu`, `AccountMenu` and `MobileMenu`) and
  `COLOR_FIELD_LOOK` (square presets framed when picked, a 28 × 36 px native picker). An app that carries these
  class strings itself replaces them with the maps, e.g. `<Checklist classNames={CHECKLIST_LOOK} …>`; one that
  merges its own classes in passes `cn(CHECKLIST_LOOK.row, …)`.

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
