# Plan: theme-notion-list-entry-menu

## Approach
A new client component `RowActionsMenu` (`src/notion/RowActionsMenu.tsx`) built from `DropdownMenu`, `Button` and
`AlertDialog`, driven by data so the destructive item is always last. `ListEntry` gets a `menu` slot rendered at the
end of the actions line; the line keeps the inline control and the menu together (`flex-nowrap` for the pair, the menu
`shrink-0`). The rules for row controls and row state go into the `ListEntry` JSDoc and the README.

## Phases
### Phase 1: RowActionsMenu and the ListEntry menu slot (TDD)
- Tests first (red): `tests/notion/RowActionsMenu.test.tsx` (happy-dom): the trigger is an icon button named "More
  actions" (and an app's label); Enter on the trigger opens the menu, ArrowDown moves between items; an item runs its
  `onSelect`; the destructive item is last after a separator with `data-variant="destructive"`; with `confirm` it opens
  an alert dialog (title, description, cancel, a destructive confirm) and runs only on confirm; without `confirm` it
  runs at once. `tests/notion/List.test.tsx`: the `menu` slot renders on the actions line after the actions, alone
  when there are no actions, and makes the column exist.
- Chromium measurement in `visual/fit.spec.ts` with a gallery case (a switch, a result badge, three secondary actions
  and a destructive one): at 1280 and 390 px the badge is above, the switch and the menu button share one line under
  it at the right edge; at 390 px both are at least 44 px.
- `src/notion/RowActionsMenu.tsx`, `src/notion/List.tsx`, `src/messages/en.ts`, `src/index.ts`; gallery case, parity
  fixture regenerated, baselines updated and looked at, README, CHANGELOG `## Unreleased`.
- Done when: `npx vitest run themes/theme-notion` passes, typecheck and lint pass, the visual specs pass.

### Phase 2: Design System artifact
- Append `RowActionsMenu` and the `menu` slot to the "NOTION · Design System" artifact (bundle, types, the List card),
  publish.

## Decisions (auto)
- A data-driven `RowActionsMenu` (`actions`, `destructiveAction`) instead of free children: the destructive item is
  last and separated by construction, and the confirmation is wired once.
- `destructiveAction.confirm` (`title`, `description`, `confirmLabel`, `cancelLabel`) opens an `AlertDialog`; without
  it the item runs at once. The copy is the app's; only the trigger's name has an English default.
- `ListEntry` `menu` is a slot (any node), so an app may pass its own menu; `RowActionsMenu` is the recommended one.
- The rules are documentation, not runtime checks: a row may legitimately show two inline controls in a wide layout.
- Released as a minor (new exports, no dependent range broken).

## Progress
- [ ] Phase 1: RowActionsMenu and the ListEntry menu slot
- [ ] Phase 2: Design System artifact
