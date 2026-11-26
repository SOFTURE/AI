# Research: theme-notion-row-actions-async

## Findings
- `src/notion/RowActionsMenu.tsx`: the confirm button is `AlertDialogAction onClick={destructiveAction.onSelect}`.
  `AlertDialogAction` is Radix's `AlertDialog.Action`, which closes the dialog on click unless the click event is
  default-prevented. So keeping the dialog open needs `event.preventDefault()` in the handler and a local pending
  state; `onOpenChange` must ignore close requests (Escape, Cancel) while pending.
- The dropdown is Radix `DropdownMenu` (modal by default). On close its content's `onCloseAutoFocus` moves focus to
  the trigger; calling `event.preventDefault()` there leaves focus where it is, which is the documented way to open a
  dialog from a menu item. The trigger's ref is internal (`useRef`), so an app cannot return focus to it.
- `src/ui/dropdown-menu.tsx`: `DropdownMenuContent size="touch"` puts items at `min-h-touch-target` through context,
  but the size is a prop, not a breakpoint. The row's own controls use `max-md:min-h-touch-target` classes
  (`src/notion/List.tsx`). An item's `className` merges after its height class, and `max-md:min-h-touch-target` does
  not conflict with `min-h-7` in tailwind-merge (different variant), so a responsive class on each item gives 44 px
  below `md` and 28 px above.
- No item carries a hook today; tests find them by their words.

## Risks
- A rejected promise must not become an unhandled rejection inside the theme, and must not be swallowed silently:
  the app owns the error (it shows its own message); the dialog staying open and enabled is the visible signal.
