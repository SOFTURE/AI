---
change_id: theme-notion-touch-sizes-880
verdict: approved
---

# Implementation review

Reviewed the diff of 8c354cd, 3d7c355 and 709d8da against plan.md and master (eea00c6).

- Acceptance of #880: `DropdownMenuContent size="touch"` raises every row (item, checkbox, radio, sub-trigger) to
  `min-h-touch-target`, a row's own `size` wins; `TabsList size="touch"` drops the fixed `h-9` and its triggers get
  `min-h-touch-target min-w-touch-target`, a trigger's own `size` wins; `AccordionTrigger size="touch"`;
  `DialogContent closeButtonSize="touch"` draws a 44 × 44 close button centred on the same icon. Tests cover each, the
  defaults, the override and a caller's `md:` class kept.
- Defaults: the parity fixture shows the default menu rows with the same classes (`min-h-7` moved to the end, as in
  `SelectItem`), the default `Dialog` and `Tabs` cases unchanged; the existing baselines changed only in the gallery
  page that gained the new cases.
- Contexts: both reach portalled content (React context crosses portals); outside a sized list the default applies.
- Guards: `tests/upstream/deltas.ts` lists every changed line with its reason; the parity fixture and the visual
  baselines are refreshed (the touch menu and dialog checked by eye in light and dark, phone and desktop); typecheck,
  lint and the theme tests are green.
- Note: `AccordionTrigger` keeps `items-start`, so a short label sits at the top of the 44 px row when a caller tightens
  the padding below 12 px; the default `py-4` row is 52 px and unaffected.

Verdict: approved.
