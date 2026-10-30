---
change_id: theme-notion-scrollable-tabs-908
---

# Research: scrollable tabs and a horizontal scroll bar (issue #908)

## What exists

- `src/ui/tabs.tsx`: `tabsListVariants` (cva, axes `variant` and `size`) draws `inline-flex w-fit`, 36 px high in a
  horizontal `Tabs`; triggers are `flex-1`, and the line variant's underline sits 5 px under a trigger
  (`after:bottom-[-5px]`), outside the list's 3 px padding. `TabsList size` reaches triggers through a context (#880).
- A grid or flex item's automatic minimum width is its min-content width, so a `Tabs` root holding a wide list widens
  its parent; `min-w-0` on the root lets it shrink, and an `overflow-x-auto` list at `w-full` then scrolls.
- Radix's roving focus moves focus with the arrow keys, and focusing a trigger scrolls it into view; a change of the
  active tab by click or by `value` does not.
- `src/ui/scroll-area.tsx` always renders one vertical `ScrollBar`; the gallery's `ScrollArea` case puts a horizontal
  `ScrollBar` inside the viewport by hand.
- Guards: upstream deltas, parity fixture, `tailwind-classes` (every class generates CSS), inventory (every cva option
  in the gallery), `visual/fit.spec.ts` (geometry checks without baselines).

## Options

1. A cva `scrollable` axis plus an effect that centres the active trigger (`scrollLeft`, so the page never scrolls),
   re-run on `data-state` changes; `has-data-[scrollable=true]:min-w-0` on the root. Chosen.
2. A separate `TabsScroller` wrapper: an extra part to learn and the same clipping of the underline. Rejected.
3. `scrollIntoView` for the active tab: also scrolls the page vertically when the strip is off screen. Rejected.
4. `ScrollArea scrollbars: "vertical" | "horizontal" | "both"` for the bar. Chosen.
