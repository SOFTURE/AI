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
- The phone rule of the actions line skips a switch: stretching the plain switch to 44 x 44 drew its track as a disc;
  `Switch size="touch"` already draws the 26 x 16 track inside a 44 px square, and the line zeroes its negative
  side margins so it never overlaps the menu button. The artifact's bundled `Switch` predates `size="touch"`, so its
  preview shows the plain switch.
- A data-driven `RowActionsMenu` (`actions`, `destructiveAction`) instead of free children: the destructive item is
  last and separated by construction, and the confirmation is wired once.
- `destructiveAction.confirm` (`title`, `description`, `confirmLabel`, `cancelLabel`) opens an `AlertDialog`; without
  it the item runs at once. The copy is the app's; only the trigger's name has an English default.
- `ListEntry` `menu` is a slot (any node), so an app may pass its own menu; `RowActionsMenu` is the recommended one.
- The rules are documentation, not runtime checks: a row may legitimately show two inline controls in a wide layout.
- Released as a minor (new exports, no dependent range broken).

## Progress
- [x] Phase 1: RowActionsMenu and the ListEntry menu slot (nine RowActionsMenu tests and three ListEntry menu tests
  red before the code; after: `npx vitest run themes/theme-notion` 1401 tests passed; typecheck, ESLint, the language
  gate and `npm run build` passed. The new Chromium measurement in `visual/fit.spec.ts` passes in all four projects
  (desktop at 1280 px, phone at 390 px, light and dark): the badge above, the switch and the menu button on one line at
  the row's right edge, both at least 44 x 44 px on the phone; Enter opens the menu, ArrowDown and End move between
  items, Enter on Delete opens the confirmation, Escape returns focus to the menu button. `npm run test:visual` 208
  passed with the four `gallery.png` baselines updated for the new `ListEntry[menu]` case (the sandbox's Chromium 1243
  headless shell; no other baseline moved). Desktop and 390 px screenshots looked at: the first one showed the phone's
  44 px rule stretching a plain switch's track into a disc, so the rule now skips a switch (`not-data-[slot=switch]`)
  and the docs ask for `Switch size="touch"`) f79cfae
- [x] Phase 2: Design System artifact (version 85-86: `ListEntry` in `bundle.js` patched for `menu` and the switch
  rule, a `RowActionsMenu` module appended, header gained {"name":"RowActionsMenu"}, three rules appended to
  `bundle.css` as a trailing `@layer utilities{}` (diffed against the gallery's compiled css), types in `index.d.ts`,
  the List card with a webhook row and the row rules; the preview rendered in Chromium at 900 and 390 px with no
  console error: the menu opens with Enter, Delete opens the confirmation, focus returns to the button)
