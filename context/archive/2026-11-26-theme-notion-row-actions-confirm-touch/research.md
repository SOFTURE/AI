# Research: theme-notion-row-actions-confirm-touch

## Findings
- `src/notion/RowActionsMenu.tsx`: the confirmation footer renders `AlertDialogCancel` and `AlertDialogAction` with no
  `size` and no `className`, so both take `Button size="default"` (`h-7`, 28 px).
- `src/ui/alert-dialog.tsx`: both wrap `Button asChild` and pass `className` through `cn`, so a class on them lands on
  the rendered `<button>`.
- `src/ui/button.tsx`: `size="touch"` is `h-touch-target px-3` on every width, which would grow the desktop buttons.
  `max-md:h-touch-target` does not conflict with `h-7` in tailwind-merge (different variant), so both stay and the
  media query wins below `md`, the same rule as `ITEM_TOUCH_CLASS` (`max-md:min-h-touch-target`) on the items.
- `tests/notion/RowActionsMenu.test.tsx` already opens the confirmation in happy-dom, so a class assertion fits there.

## Risks
- None beyond the bundled Design System artifact needing the new utility in `bundle.css`.
