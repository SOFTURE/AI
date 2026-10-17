---
change_id: ui-menus-color-presets-558
---

# Research: ui-menus-color-presets-558

Sources: `foundation/ui/src/ui/app-menus.tsx`, `disclosure-menu.tsx`, `color-field.tsx`, `modal.tsx`,
`segmented-control.tsx`, `messages/en.ts`, `foundation/ui/tests/adoption-gaps-407.test.tsx`.

- `AccountMenu` passes `icon={<UserIcon />}` to `DisclosureMenu`; with `isLabelHidden` the button's name is its
  `aria-label`, so any other icon node keeps the same name. A `trigger` prop is a one-line change.
- `DisclosureMenu` spreads `useDisclosure().panelProps` (`hidden: !isOpen`) and styles `[&[hidden]]:hidden`. There
  is no transition on the panel today (the issue's "enter one" does not exist in the classes), so both directions
  are new. `useDisclosure` is public (apps spread its props on their own markup), so the leave state belongs in the
  component, not the hook.
- `modal.tsx` already solves the leave motion for `motion="enter-leave"`: `getLeaveTime` reads the computed
  transition and animation durations, waits for `transitionend`/`animationend` and falls back to a timer
  (`LEAVE_TIMEOUT_MS`). Under `motion-reduce:transition-none` the duration is 0 and it closes at once. Reusing the
  helpers keeps one implementation.
- Other components already animate in with `starting:` (toast, modal overlay), so `@starting-style` is the house
  way; it fires when the panel leaves `display: none`.
- `MobileMenu` renders `<nav><ul><li><a>`; a grouped list nests a `<ul>` per heading inside an `<li>`, the WAI
  pattern for a navigation with sections.
- `SegmentedControl` uses native radios with a `name`. Inside `ColorField` that would put an extra entry in the
  form's data (the field submits only the text input today), so the presets use buttons with radio semantics.
- `normalizeHexColor` gives the comparison for the checked swatch (case and `#rgb` forms).
