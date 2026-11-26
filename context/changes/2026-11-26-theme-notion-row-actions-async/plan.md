# Plan: theme-notion-row-actions-async

## Approach
All in `src/notion/RowActionsMenu.tsx`. The confirm button prevents Radix's close, calls `onSelect`, and when it
returns a promise sets `isPending` until it settles: resolve closes the dialog, rejection re-enables it and keeps it
open. While pending, `onOpenChange` ignores closes and both buttons are disabled; the confirm button shows
`pendingLabel` (falls back to `confirmLabel`) and `aria-busy`. A menu item with `opensDialog` sets a ref that makes the
content's `onCloseAutoFocus` prevent the focus return. `triggerRef` is merged with the internal ref. Each item gets
`data-row-action={id}` and the class `max-md:min-h-touch-target`.

## Phases
### Phase 1: async confirm, opensDialog, triggerRef, touch items and hooks (TDD)
- Tests first (red) in `tests/notion/RowActionsMenu.test.tsx`: the dialog stays open with both buttons disabled and
  the pending word while the promise is pending, closes on resolve, stays open and enabled on rejection, and ignores
  Escape while pending; an `opensDialog` item leaves focus in the app's dialog; `triggerRef` reaches the button; items
  carry `data-row-action` and the touch class below `md`.
- Code, README (`RowActionsMenu` paragraph), CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, typecheck, lint and build pass.

### Phase 2: Design System artifact
- Update the bundled `RowActionsMenu` and its types in the "NOTION · Design System" artifact, publish.

## Decisions (auto)
- `onSelect` of the destructive action is typed `() => void | Promise<unknown>`; the other actions keep `() => void`.
  Without `confirm` a returned promise is not awaited (the menu is already closed), so the app sees its own rejection.
- A rejection is caught only to keep the dialog open; the app reports the error (documented in the JSDoc).
- Touch size by a responsive class on each item, not `size="touch"`, so a desktop keeps the compact 28 px items.
- `triggerRef` as a prop rather than `forwardRef`, matching the issue's first option and React 19 ref-as-prop.
- Released as a minor (additive props, no dependent range broken).

## Progress
- [ ] Phase 1
- [ ] Phase 2
