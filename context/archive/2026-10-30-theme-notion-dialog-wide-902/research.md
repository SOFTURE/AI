---
change_id: theme-notion-dialog-wide-902
---

# Research: wide dialog and footer close label (issues #902, #903)

## What exists

- `src/ui/dialog.tsx`: `DialogContent` carries `w-full max-w-[calc(100%-2rem)] … sm:max-w-lg` in its static class
  string and already takes `closeLabel` (default `messages.dialog.close`) and `closeButtonSize` (#880).
- `DialogFooter showCloseButton` renders `<Button variant="outline">Close</Button>` from upstream shadcn; no prop,
  no message.
- `src/messages/en.ts` has `dialog: { close: "Close" }`; `tests/behaviour/messages.test.tsx` keys one case per
  message, so the footer label is tested in `tests/ui/dialog.test.tsx` instead.
- `AlertDialogContent` sizes through `data-size` and `data-[size=…]:` classes; `closeButtonSize` on the same
  component uses a plain conditional class through `cn`.
- Tailwind v4 has fraction max widths: `max-w-1/2` is `calc(1/2 * 100%)`. The content is `position: fixed`, so 100%
  is the viewport. At `lg` (1024 px) half is 512 px, the same as `max-w-lg` (32 rem): no jump at the breakpoint.
- `cn` (tailwind-merge) keeps `sm:max-w-lg` and `lg:max-w-1/2` together (different variants), and a caller's
  `className` still wins per variant.
- Guards: `tests/upstream.test.ts` with `tests/upstream/deltas.ts`; `tests/parity.test.tsx` with
  `tests/fixtures/notion-slots.json` (`UPDATE_FIXTURES=1`) as the components' design-system snapshot;
  `tests/tailwind-classes.test.ts`; visual baselines under `visual/baselines/`.

## Options

1. `size` prop adding `lg:max-w-1/2` conditionally, like `closeButtonSize`. Chosen: smallest change, defaults keep
   their exact class list.
2. `data-size` attribute with `data-[size=wide]:lg:max-w-1/2`, like `AlertDialogContent`. Adds an attribute to every
   default dialog (fixture churn) for no gain. Rejected.
3. The optional scrolling body slot from #902: out of scope for this change (the acceptance does not ask for it);
   apps keep `max-h-[85dvh] overflow-y-auto`. Can be its own issue.
