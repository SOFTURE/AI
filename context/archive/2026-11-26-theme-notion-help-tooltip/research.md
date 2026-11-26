# Research: theme-notion-help-tooltip

## Findings
- `src/ui/tooltip.tsx` is the shadcn wrapper: `TooltipProvider` (`delayDuration` 0), `Tooltip` (Radix `Root`),
  `TooltipTrigger`, `TooltipContent` (portal, `bg-tooltip`). It is kept in parity with shadcn (`tests/upstream.test.ts`),
  so the fix belongs in a composition, not in the wrapper.
- Radix `TooltipTrigger` (`@radix-ui/react-tooltip`): `onPointerMove` opens on a non-touch pointer once per entry,
  `onPointerLeave` closes, `onPointerDown` closes when open, `onFocus` opens unless a press is in progress, `onBlur`
  closes, `onClick` closes. Every handler is `composeEventHandlers(props.handler, own)`, which skips its own when the
  app's handler called `preventDefault()`.
- The race: hover opens, the press closes, leaving and re-entering while pressed opens again (hover), the release's
  click closes. A trigger whose click calls `preventDefault()` and opens (instead of toggling) ends open in every order.
- On touch Radix's pointer move does nothing; a tap fires pointer down, up, leave, then click. The trigger's leave
  closes only with `disableHoverableContent`; otherwise the hoverable content closes on the next pointer move outside
  the trigger and the tooltip, which a finger does not make, so a tapped tooltip stays open until a press outside.
- Escape and a press outside close through `TooltipContent`'s dismissable layer (`onOpenChange(false)`).
- Radix `Tooltip` needs a `TooltipProvider` above it; the theme only puts one in `Sidebar`. A component that works
  anywhere renders its own provider.
- Patterns to follow: `CopyButton` and `RowActionsMenu` (`Button` `variant="ghost"`, an `ICON_STROKE_WIDTH` icon,
  English default name from `messages/en.ts`, a `label` prop); the touch target below `md` through
  `max-md:size-touch-target` (`Button size="icon-touch"` is `size-touch-target`).
- Registration a new composition needs: `src/index.ts`, README (name sentence, "Copy" list, a section),
  `tests/gallery/cases.tsx` (inventory test), `tests/fixtures/notion-slots.json` (`UPDATE_FIXTURES=1`),
  `tests/behaviour/messages.test.tsx` (every message path), the visual `gallery.png` baselines.

## Risks
- happy-dom has no layout; the race test drives Radix through `fireEvent.pointerMove/pointerLeave/pointerDown/click`
  and reads the `data-state` of the trigger, which does not need layout.
- The full-page visual baselines change with a new gallery case; regenerate them in the pinned Chromium.
