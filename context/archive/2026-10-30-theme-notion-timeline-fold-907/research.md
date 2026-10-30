---
change_id: theme-notion-timeline-fold-907
---

# Research: folding timeline entry and FoldRow touch size (issue #907)

## What exists

- `src/notion/Timeline.tsx` is a server-safe file (no `"use client"`): an app passes Lucide icons (functions) in
  `items`, which cannot cross a server-to-client boundary. Its body is a `div` or, with `onSelect`, a `button`;
  `children` render in `timeline-item-content` under it.
- `src/notion/FoldRow.tsx` is a native `<details>` whose summary is `min-h-row-height`.
- `src/ui/collapsible.tsx` (Radix, `"use client"`): `CollapsibleTrigger` is a button with `aria-expanded`,
  `aria-controls` and `data-state`; `CollapsibleContent` mounts its children only while open. A server component may
  render these client parts.
- `tests/inventory.test.ts` requires every value exported by a `src/notion` file to be exported from the root, so an
  internal `"use client"` helper file there is not possible without a public export.
- The `touch-target` token (44 px) and the opt-in prop pattern come from #859 and #880.

## Options

1. `fold` on `TimelineItem` rendered through the theme's `Collapsible`; `FoldRow size="touch"`. Chosen: both
   options of the issue, no new client file, `Timeline` stays server-safe.
2. A `"use client"` Timeline with its own state: breaks server use with icons. Rejected.
3. A native `<details>` per entry: no `aria-expanded` attribute, which the acceptance asks for. Rejected.
