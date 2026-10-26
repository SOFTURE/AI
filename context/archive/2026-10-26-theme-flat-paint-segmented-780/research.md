---
change_id: theme-flat-paint-segmented-780
---

# Research

## R1: what ui renders

`foundation/ui/src/ui/segmented-control.tsx`: slots `root | legend | options | option | input | label`; `fieldset >
legend + div(options) > label(option) > input(radio) + span(label)`. Default `option` marks the checked one with
`has-checked:bg-accent-fill` (lime) plus an inset ring. `isLegendHidden` only swaps the default legend class, so with
`unstyled` the `legend` slot decides alone. `theme-switch.tsx`: `ThemeSwitchSlot = SegmentedControlSlot`, renders a
`SegmentedControl`, passes `classNames` and `unstyled` through.

## R2: what the theme has

`themes/theme-flat-paint/src/look/controls.ts`: `SEGMENTED_GROUP_LOOK`, `SEGMENT_IDLE_LOOK`, `SEGMENT_ACTIVE_LOOK`,
`SEGMENT_ACTIVE_WHEN_CURRENT_LOOK` (`data-current:`). `CHECKBOX_LOOK` is the precedent for a full slot map typed
by a locally declared slot union. `theme.css` lists `./look` as a Tailwind source, so new literals compile without
an app `@source` (`tests/theme-css.test.ts` checks compiled selectors).

## R3: classes

The adopting app's map (from the issue): option = idle + `has-checked:` active classes + a 2 px `accent` outline on
`has-[:focus-visible]`, options = group, legend and input `sr-only`. Tailwind 4 has a `has-focus-visible:` variant
(ui uses it), equivalent and shorter. The `fieldset` needs `m-0 min-w-0 border-0 p-0` once ui's defaults are off.
Variant classes sort after plain ones, so `has-checked:font-semibold` beats `font-medium`.
