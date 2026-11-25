# Research: theme-notion-list-entry-menu

## Question
How should a row overflow menu be built on the theme's primitives, and how does it sit in `ListEntry`'s right column
so the inline control and the menu button stay on one line at every width?

## Findings
- `src/notion/List.tsx`: `ListEntry` is a server component. Its right column is `list-entry-status` over
  `list-entry-actions`; the actions line is `flex-wrap justify-end` and makes every direct child at least the touch
  target below `md` (`max-md:*:min-h-touch-target max-md:*:min-w-touch-target`). A menu placed as the last child of
  that line inherits the phone rule; to keep it beside the inline control, the line must not wrap between the two.
- `src/ui/dropdown-menu.tsx`: `DropdownMenuItem` already has `variant="destructive"` (danger text and icon, a danger
  focus tint) and `DropdownMenuSeparator`. Radix's menu opens from the trigger with Enter, Space and ArrowDown and
  moves between items with the arrow keys, so keyboard access comes with the primitive.
- `src/ui/alert-dialog.tsx`: `AlertDialogAction` takes a `variant` (`destructive` exists on `Button`). Opening an
  alert dialog from a menu item needs a controlled `open` state outside the menu (the menu unmounts its items on
  close); focus has to go back to the menu button when the dialog closes, since the item that opened it is gone.
- `src/ui/button.tsx`: `size="icon"` is 28 px, `icon-touch` is the 44 px target; `ListEntry`'s phone rule already
  lifts any direct child to 44 px, so the menu button keeps `icon` and gets the target from the line.
- `src/messages/en.ts`: every accessible name has an English default and a prop to replace it (`CopyButton`'s
  `label`). A new `rowActions.more: "More actions"` fits the same pattern; `tests/messages.test.tsx` checks the
  dictionary is used.
- Icons: lucide `Ellipsis` (horizontal dots) is the theme's "more" (`breadcrumb.more` uses `MoreHorizontal`, its
  alias); stroke from `ICON_STROKE_WIDTH`.
- Consumers to update: `src/index.ts`, the inventory test, the parity fixture (`notion-slots.json`), gallery cases,
  visual baselines, `visual/fit.spec.ts`, README, CHANGELOG, the Design System artifact bundle.
