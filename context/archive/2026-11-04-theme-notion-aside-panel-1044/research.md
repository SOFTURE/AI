# Research: AsidePanel (issue #1044)

## What exists

- `SidebarProvider` (`src/ui/sidebar.tsx`) takes `open`/`onOpenChange` for control from outside and switches to a
  sheet below `MOBILE_BREAKPOINT` (`useIsMobile` from `@softure-ai/theme-kit/react`, 768 px).
- `Sheet`/`SheetContent side="right"` is the phone pattern the sidebar already uses.
- `SidePanel` (#724) is an absolute panel over a canvas with its own close button; it has no kept state, no sidebar
  handover and no sheet, so it cannot be stretched to this need without changing its contract.
- Copy lives in `src/messages/en.ts`; every text has a prop that replaces it; `tests/behaviour/messages.test.tsx`
  checks each key is used and replaceable.
- New compositions need a gallery case (`tests/gallery/cases.tsx`), slots in `tests/fixtures/notion-slots.json`,
  a README entry (inventory test) and the visual baselines.

## Options

1. **The provider owns the sidebar's open state** (renders `SidebarProvider` with a derived `open`): the sidebar is
   folded whenever the panel is open on a wide screen and the screen offers a panel. No effect, so no flash of an open
   sidebar on load with a kept open panel, and a sidebar opened any other way (its trigger, Ctrl+B) closes the panel.
2. Provider inside `SidebarProvider`, syncing through `useSidebar().setOpen` in effects: one render with both panels
   open on load, and two sources of truth.

Recommendation: option 1.

## Risks

- Escape must not close the panel while a Radix overlay handles the same key: the document listener reads the DOM
  (`isOverlayOpen`) during the same dispatch, before React commits the overlay's close.
- `:popover-open` is not supported by every DOM (happy-dom): the selector is tried on its own and a syntax error
  counts as "no match".
