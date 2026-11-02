---
change_id: theme-notion-dialog-footer-close
status: done
---

# Research

- `themes/theme-notion/src/ui/dialog.tsx` `DialogFooter`: `{children}` then, with `showCloseButton`,
  `<DialogPrimitive.Close asChild><Button variant="outline">{closeLabel}</Button></DialogPrimitive.Close>`.
- `src/ui/button.tsx` passes its props to a `<button>` (or a `Slot`) and sets no `type`, so the HTML default
  `submit` applies inside a form. Radix `Close asChild` merges its `onClick` into the child and adds no `type`.
- `flex-col-reverse sm:flex-row sm:justify-end`: on a phone the first child is at the bottom, from `sm` on the left.
  Rendering the close button first therefore gives cancel left of confirm and confirm above cancel, the order of
  `AlertDialogFooter` (`AlertDialogCancel` then `AlertDialogAction` in its docs).
- The upstream guard (`tests/upstream.test.ts`) needs the footer's changed lines in `tests/upstream/deltas.ts`
  (entries for #903 already touch the footer's signature and the button text).
- `tests/ui/dialog.test.tsx` has a `DialogFooter close button` suite rendering the footer without a form.
- `alert-dialog.tsx` is not affected: `AlertDialogCancel` is a Radix `Cancel`, which the app places itself.
