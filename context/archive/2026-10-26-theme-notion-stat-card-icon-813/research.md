---
change_id: theme-notion-stat-card-icon-813
---

# Research

- `StatCards` renders the label as `<div class="text-section-label text-muted-foreground">{label}</div>`; the figure,
  bar, hint and aside follow. Tests pin the label's text nodes (`readTextNodes`) and the figure's markup.
- Icon props in the package come in two shapes: `ReactNode` (`PropertyList`, `PageHeader`, `FilterChip`, `TabBar`:
  the app draws the icon) and `LucideIcon` (`Status`, `MarkPopover`: the component draws it with
  `ICON_STROKE_WIDTH`, `aria-hidden` and its own size). The issue wants the stroke width, the size and the muted colour
  set by the card, which only the component type guarantees.
- `StatCard` is a plain data object (cards are passed as an array), so a component type also keeps the cards
  serialisable-looking and free of JSX in data.
- Sizes: 16 px is `size-4`, a 6 px gap is `gap-1.5`; `currentColor` of the label row gives the muted colour.

## Options

1. `icon?: LucideIcon`, drawn `size-4 shrink-0` with `ICON_STROKE_WIDTH` and `aria-hidden` inside a flex label row
   (`flex items-center gap-1.5`) only when given. Chosen: matches `Status`, guarantees the design's line and size.
2. `icon?: ReactNode`. Rejected: the app would have to repeat the size, stroke and `aria-hidden`.
