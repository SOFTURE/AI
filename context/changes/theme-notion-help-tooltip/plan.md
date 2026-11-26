# Plan: theme-notion-help-tooltip

## Approach
`HelpTooltip` in `src/notion/HelpTooltip.tsx`: its own `TooltipProvider` (delay 0), a controlled `Tooltip`, a
`TooltipTrigger asChild` around a ghost icon `Button` (`CircleHelp`, `size="icon"`, `max-md:size-touch-target`,
`aria-label={label}`). The trigger's `onClick` calls `preventDefault()` and opens; its `onPointerLeave` calls
`preventDefault()` for a touch pointer. Hover, focus, blur, a mouse leave, Escape and a press outside reach the state
through Radix's `onOpenChange`. The hint renders twice: in `TooltipContent` and in a `sr-only` span with `hintId`
(given or `useId`) for the field's `aria-describedby`.

Props: `children` (the hint), `label` (default `messages.helpTooltip.label`, "Help"), `hintId`, `side`, `align`,
`className` (button), `contentClassName`, `onOpenChange`.

## Phases
### Phase 1: HelpTooltip (TDD)
- Test first (red) in `tests/notion/HelpTooltip.test.tsx`: the press / leave / re-enter / release race leaves the
  tooltip open; a click and a tap open it and a second click keeps it open; Escape, blur and a mouse leave close it;
  the hidden hint carries `hintId` and the hint text; the button's name is the label; the touch class is present.
- Code, export, message, messages test entry, gallery case, fixture, README, CHANGELOG `## Unreleased`, visual
  baselines.
- Done when: `npx vitest run themes/theme-notion` passes; typecheck, lint and build pass; visual baselines updated.

### Phase 2: Design System artifact
- Add `HelpTooltip` to the bundled artifact and publish.

## Decisions (auto)
- A composition, not a change of `TooltipTrigger`: the ui wrapper stays shadcn's.
- Open on click instead of toggling (the issue's proposal): a second click keeps the hint, Escape or a press outside
  closes it; no state flips on a race.
- Its own `TooltipProvider`, so it works outside `Sidebar` with no setup.
- Accessible name "Help" by default, replaced by `label` ("Help for Email").
- Released as a minor: a new export, no change to existing ones.

## Progress
- [ ] Phase 1: HelpTooltip (TDD)
- [ ] Phase 2: Design System artifact
