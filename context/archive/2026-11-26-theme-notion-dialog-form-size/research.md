# Research: theme-notion-dialog-form-size

## Findings
- `themes/theme-notion/src/ui/dialog.tsx`: `DialogContent` is a fixed, centred `grid` with `p-6 gap-4`,
  `max-w-[calc(100%-2rem)]` (the phone gutter) and `sm:max-w-lg`; `size` adds `wide` (`lg:max-w-1/2`), `lg`
  (fixed height, flex column, scrolling) and `sm` (`max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md`).
  `className` merges last through `cn` (tailwind-merge), so a later class wins.
- `DialogFooter` is `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`; in a column the buttons stretch to the
  full width and the last child (the primary) is on top. `showCloseButton` renders the cancel button first.
- The app's workaround (issue): `size="wide"` + `max-h-[calc(100dvh-2rem)] overflow-y-auto` on the content, and
  `sticky -bottom-6 -mx-6 -mb-6 border-t border-border bg-popover px-6 py-4` on the footer. The negative bottom offset
  equals the content's `p-6`: a sticky box's insets are measured against the scroll container's padding box deflated
  by its padding, so `-bottom-6` puts the footer on the dialog's visible bottom edge; `-mx-6 -mb-6` let it bleed to
  the edges and end flush when scrolled to the end; `bg-popover` hides the fields scrolling under it.
- Tailwind 4: `max-w-2xl` is 42 rem (672 px), inside the content's `p-6` that leaves 624 px for fields, the issue's
  "about 640 px". No width token for dialogs exists; the existing sizes use the Tailwind container scale.
- Checks today: `tests/ui/dialog.test.tsx` (size classes, footer close button), `tests/upstream.test.ts` with
  `tests/upstream/deltas.ts` (the file equals the pinned shadcn upstream plus listed deltas), `tests/parity.test.tsx`
  (`tests/fixtures/notion-slots.json`), gallery cases (`tests/gallery/cases.tsx`, screenshots per project in
  `visual/baselines/*/gallery.png`).
- The Design System artifact carries `Dialog` in its `bundle.js`; it has to follow.

## Options
1. A `form` size on `DialogContent` plus an explicit `sticky` boolean on `DialogFooter`. The footer works in any
   scrolling dialog (`sm`, `lg`, `form`), and the app opts in where it wants it.
2. The `form` size makes its footer sticky through a group selector on `data-size`. Implicit, and it couples the footer
   to one size; a `sm` dialog with a long form would not get it.

Recommendation: option 1.
