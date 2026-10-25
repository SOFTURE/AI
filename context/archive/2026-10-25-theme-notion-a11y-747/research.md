# Research: theme-notion ItemGroup and ScrollArea accessibility (issue #747)

## Current state (master 33dadbb)

- `themes/theme-notion/src/ui/item.tsx` is shadcn's `item`: `ItemGroup` renders `<div role="list">`, `Item` renders
  a `div` (or its child through `Slot` with `asChild`) with no role. axe's `aria-required-children` fails on every
  group of items.
- `src/ui/scroll-area.tsx` is shadcn's `scroll-area`: the Radix `Viewport` is the scrolling element, it carries
  `focus-visible:ring-2 focus-visible:ring-ring` but no `tabIndex`, and `ScrollArea` spreads its props on the `Root`
  only. axe's `scrollable-region-focusable` fails when the content has nothing focusable.
- `tests/upstream/deltas.ts` and `visual/gallery.spec.ts` come with #741, not on master yet; the package's list of
  deltas from stock shadcn lives in its README ("Deltas from stock shadcn").
- `tests/ui/*.test.tsx` render with `renderToStaticMarkup` and assert attributes in the HTML.

## Findings

- An `ItemGroupContext` (boolean) set by `ItemGroup` lets `Item` add `role="listitem"`; a `role` prop passed by the
  caller wins because the props spread after it.
- With `asChild` the role would land on the child element (often an `<a>`) and replace its own role (a link would
  stop being a link), so an `asChild` item gets no role; the README tells the caller to wrap it in an element with
  `role="listitem"`.
- `ScrollArea` gets a `viewportProps` prop spread on the `Viewport` after `tabIndex={0}`, so `tabIndex={-1}` (or any
  viewport prop) overrides it. The existing focus ring then shows on Tab.
