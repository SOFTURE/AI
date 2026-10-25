---
change_id: theme-notion-tab-state-contrast
---

# Research

## The selected pill today

`TabsList` default is `bg-muted`; an active `TabsTrigger` is `bg-background` + `shadow-sm` in light and
`border-border` + `bg-accent/40` in dark (after #759). The text moves from `muted-foreground` to `foreground`.

| Indicator | Light | Dark |
| --- | --- | --- |
| Pill fill against the list | 1.07 | 1.06 |
| Pill border against the list | none | 1.1 |
| Text colour change (`foreground` against `muted-foreground`) | below 3 | below 3 |

`shadow-sm` is a soft blur; it is not a boundary of a measurable colour.

## Candidates

1. **A boundary on the selected pill in `input`** (the field boundary, raised to 3:1 by #759). The border is painted
   over the element's own background, so it composites over the pill or, with `bg-clip-padding`, over the list:

   | `input` border | against the list | against the pill |
   | --- | --- | --- |
   | light, over the pill (`border-box`) | 2.95 | 3.17 |
   | light, over the list (`bg-clip-padding`) | 3.13 | 3.35 |
   | dark, over the pill (`border-box`) | 3.46 | 3.26 |
   | dark, over the list (`bg-clip-padding`) | 3.30 | 3.11 |

   With `bg-clip-padding` both schemes pass on both sides. The pill keeps its white (dark: lifted) fill and shadow and
   gains a mid-grey hairline, the same weight as a text field: it reads as Notion's raised segmented control.
2. **An underline inside the pill** (as the `line` variant, in `foreground`): passes easily, but puts two selected
   indicators (fill and underline) on one control and changes the look to a mix of both variants.
3. **A filled pill** (`foreground` or `primary` fill with inverted text): passes, but turns a quiet switcher into a
   primary action, against the theme's "one primary per screen".

Candidate 1 is the smallest change and keeps the look.

## Tailwind details

- The line variant already overrides the active border in dark (`border-transparent`); the override must hold in both
  schemes once the active border applies in light too.
- A focused trigger sets `focus-visible:border-ring`; the active border must not hide it on a focused selected tab.
