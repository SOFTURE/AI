---
change_id: theme-flat-paint-radio-794
---

# Research

## R1: what the theme has

`themes/theme-flat-paint/src/look/controls.ts`: `CHECKBOX_LOOK` (a slot map typed by a local union: `box`, `input`,
`frame`, `mark`), the switch looks, the segmented control maps (#780). The checked checkbox is
`border-accent bg-accent-fill` with an `on-accent` tick; the switch knob is `on-accent` on lime. `theme.css` lists
`./look` as a Tailwind source, so any new file there compiles without an app `@source`
(`tests/theme-css.test.ts` checks compiled selectors). The tokens carry `shadow-selected-row`
(`inset 3px 0 0 #cff26b`), the same bar as the issue's `shadow-[inset_3px_0_0_var(--accent-fill)]`, and the radius
`nested` (8 px).

## R2: ui

`foundation/ui` has no radio group: only `SegmentedControl` renders native radios. So there is no ui slot type to pin
the new slot unions to; they are the theme's own and documented with the markup.

## R3: the two hand-written looks (from the issue)

- Row: hover `bg-foreground/[0.03]`, checked `bg-foreground/[0.04]` plus the 3 px bar, focus ring inset on the label,
  input `checked:border-[6px] checked:border-accent` (a ring).
- Card: `rounded-nested border-line-strong bg-surface p-4`, hover `border-muted`, checked `border-foreground` plus a
  1 px inset ring, focus ring on the label, input a lime disc with a 12 px `CheckIcon` scaling in on `peer-checked`.
- Both: the title gets `group-has-[:checked]:font-bold` as the second carrier of the state.

## R4: contrast

The control boundary is `line-strong` (≥ 3:1 on every surface) idle and `accent` checked (≥ 3:1, already asserted in
`tests/contrast.test.ts`); the check is `on-accent` on `accent-fill` (≥ 4.5:1, asserted). Lime alone is 1.27:1 on
white, so the checked disc keeps the `accent` border.

## R5: focus on a checked card

The card's checked state uses a ring (`ring-1 ring-inset ring-foreground`) and the issue's focus also uses a ring
(`ring-2 ring-accent`): both write `--tw-ring-*`, so on a focused, checked card the result depends on variant order
and the focus ring turns inset. An outline (as `SEGMENTED_CONTROL_LOOK` does) does not collide.
