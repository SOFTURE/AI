# Research: theme-notion-checkbox-indeterminate

## Findings
- `themes/theme-notion/src/ui/checkbox.tsx`: the root's classes style `data-[state=checked]` only (filled `primary`
  box, `primary-foreground` icon); the `CheckboxPrimitive.Indicator` always renders `CheckIcon` (`size-3.5`).
- Radix `Checkbox.Root` with `checked="indeterminate"` (or `defaultChecked="indeterminate"`) sets
  `data-state="indeterminate"` and `aria-checked="mixed"`; the `Indicator` is rendered for both `checked` and
  `indeterminate` and carries the same `data-state`. In the uncontrolled case the state leaves `indeterminate` on the
  first click, so the icon cannot be chosen from props alone.
- shadcn's tri-state pattern: the same filled look for both states and a minus icon for `indeterminate`.
- Checks today: `tests/ui/checkbox.test.tsx` (icon size), `tests/behaviour/controls.test.tsx` (toggling),
  `tests/upstream.test.ts` (the file equals the pinned shadcn upstream plus `tests/upstream/deltas.ts`),
  `tests/parity.test.tsx` (`notion-slots.json` fixture), the gallery case `Checkbox` (screenshots per project).
- The Design System artifact carries `Checkbox` in its `bundle.js`; it has to follow.

## Options
1. CSS only: the root gets `data-[state=indeterminate]:*` classes; the indicator renders both icons, each shown by the
   indicator's own `data-state` through a named group (`group/checkbox-indicator`). Works controlled and uncontrolled.
2. Read the state from props and pick one icon. Wrong in the uncontrolled case after the first click.

Recommendation: option 1.
