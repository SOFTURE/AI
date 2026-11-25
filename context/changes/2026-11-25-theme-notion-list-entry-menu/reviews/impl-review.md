# Implementation review: theme-notion-list-entry-menu

Verdict: approve. Matches the plan: `RowActionsMenu` is data-driven, so the destructive item is last and separated by
construction; it is built only from the theme's `DropdownMenu` (destructive variant), `Button` and `AlertDialog`, with
the dialog's state outside the menu and focus returned to the menu button (measured in Chromium and in happy-dom).
The trigger's accessible name comes from the message layer (`rowActions.more`) and is overridable, covered by the
messages test. `ListEntry`'s `menu` slot is additive; the actions line keeps the inline control and the menu together
(`flex-nowrap` only when a menu is given, so rows without one still wrap as before). One deviation, found by looking
at the screenshots and recorded under Decisions: the phone's 44 px rule no longer stretches a switch, and the docs say
to pass `Switch size="touch"`; no existing gallery case or baseline moved. README, CHANGELOG (`Unreleased`, with a
migration line), JSDoc, gallery case, parity fixture, baselines and the Design System artifact say the same. No
findings.
