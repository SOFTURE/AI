---
change_id: theme-notion-timeline-838
---

# Research

- Closest compositions: `Steps` (ordered states, no rail, no time) and `FoldRow` (a folding row). Neither draws a
  timeline; `Steps` shows the conventions to follow: an `<ol>` with `aria-label`, `data-slot` per part, literal class
  maps per value, `//` comments, no client directive.
- Palette: `<colour>-tag` / `<colour>-tag-foreground` fills are opaque in both themes (tokens.ts), so a marker hides
  the rail behind it; `text-<colour>` and `bg-<colour>` exist for the compact marker and dot.
- `SidePanel` is `bg-background`, so a compact marker on `bg-background` cuts the rail cleanly in a panel.
- Gates for a new composition: README component list and section (inventory test), gallery case (inventory, render,
  parity fixture), visual baselines (`gallery.png` changes), axe on the gallery, coverage 90%.
