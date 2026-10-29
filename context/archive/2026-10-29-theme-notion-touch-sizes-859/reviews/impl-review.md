---
change_id: theme-notion-touch-sizes-859
verdict: approved
---

# Implementation review

Reviewed the diff of 07adda5 and 45e0df4 against plan.md and master (a5301e4).

- Acceptance of #859: `Button` `touch` (44 px high) and `icon-touch` (44 × 44); `SelectTrigger` `size="touch"`;
  `SelectItem` at least 44 px for a touch list (`SelectContent size="touch"`) or one item. Tests cover each size, the
  defaults unchanged, an item overriding its list, and a caller's `md:` class kept next to every touch class.
- Desktop fallback: the touch heights are plain classes, so the caller's breakpoint class wins in the cascade (media
  rules follow the base rules); documented with an example in the README.
- `SelectItem`'s `min-h-7` moved from the static string to the size condition: `cn` does not merge `min-h-7` with
  `min-h-touch-target` (the kit's merge does not know the theme's spacing names), so both heights would otherwise
  reach the DOM and the cascade, not the size, would decide. Same rendered classes for the default size (order only).
- Guards: `tests/upstream/deltas.ts` lists every changed line with its reason in file order; the parity fixture gained
  only the new cases and the moved `min-h-7`; every new class generates CSS (`tailwind-classes.test.ts`).
- Compatibility: only new union members and optional props; no exports removed.
- Follow-up outside this change: the kit's `cn` does not merge the theme's spacing names (a caller's `h-touch-target`
  on a default `Button` keeps `h-7` too); tracked in #860, running in parallel.

Verdict: approved.
