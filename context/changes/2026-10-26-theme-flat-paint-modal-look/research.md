---
change_id: theme-flat-paint-modal-look
status: done
---

# Research

## R1: ui's Modal and StandingPanel

`foundation/ui/src/ui/modal.tsx`. Slots (both components): `overlay`, `panel`, `header`, `heading`, `title`,
`subtitle`, `close` (`close` goes to the `IconButton` root). Widths: `form`, `confirmation` (a bottom sheet on a
phone, centred from `sm`) and `panel` (full height from the right). StandingPanel is always the `panel` width.

ui's own entrance: the overlay `transition-opacity` from `starting:opacity-0`, the panel `transition-transform` from
`starting:translate-y-4` (side panel `translate-x-4`), and `data-state="closing"` drives the leave for
`motion="enter-leave"` (it waits for transitions or animations; none running means it closes at once).

## R2: transitions beat animations in the cascade

A running transition on `translate` outranks an animation of the same property, so the panel's starting-style
transition would fight a `translate` keyframe. The panel therefore also takes `transition-none` (the issue lists it
for the veil only). With every transition off, the closing state finds nothing running and closes at once: no exit
animation, as the design system asks.

## R3: the theme today

`page.css` holds the motion tokens (`--duration-base` 200 ms, `--duration-slow` 240 ms, `--ease-out-soft`) and a
reduced-motion rule that cuts every animation to 1 ms, so new keyframes are covered. `look/button.ts` has
`getIconButtonLook(size, tone)`, the pattern for `getModalLook(width)`. The `page` text style is 1.875 rem / 700.
`sm` is 40 rem in Tailwind v4, the issue's breakpoint.
