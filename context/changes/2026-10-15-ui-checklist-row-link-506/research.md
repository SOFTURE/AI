---
change_id: ui-checklist-row-link-506
---

# Research: ui-checklist-row-link-506

Sources: `foundation/ui/src/ui/checklist.tsx`, `foundation/ui/src/ui/icons.tsx`, `foundation/ui/src/ui/class-names.ts`,
`foundation/ui/tests/adoption-gaps-407.test.tsx` (Checklist block), `foundation/ui/README.md` (checklists section).

- Today each `<li>` (slot `item`, a flex row) holds the marker (`aria-hidden`), then `body` with either the `link`
  (open item with `href`) or a plain `label` span, then the description. The link holds the label and the sr-only
  state suffix only, so the description and the marker are outside the target.
- `isLink = !item.done && item.href !== undefined`: a done item never links.
- `ChevronRightIcon` already sets `aria-hidden="true"`, so a trailing chevron adds nothing to the link's name.
- The link's accessible name with `rowLink` becomes label, suffix and description; that matches the app's existing
  row link and keeps the state in the name.
- `createSlotClassGetter` takes defaults per slot; a new slot is a new key in `ChecklistSlot`, which is additive.
