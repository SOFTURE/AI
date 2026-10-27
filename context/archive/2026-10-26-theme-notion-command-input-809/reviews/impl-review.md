---
change_id: theme-notion-command-input-809
verdict: approved
---

# Implementation review

- Plan conformance: the three phases done as planned; no deviation.
- Accessible name: `CommandDialog` passes `title` to cmdk's `label`; tests name the combobox by the default and a
  given title, and a bare `Command label`. The dialog and combobox tests fail without the fix (checked by reverting
  `command.tsx`).
- Input row: `children` render after the input inside `data-slot="command-input-wrapper"`; `wrapperClassName` is
  merged with `cn`, so `h-12` replaces `h-9`; without it the row's classes are byte-equal (test, slot snapshot).
- Upstream guard: both edits listed in `UI_DELTAS.command` with their reasons.
- Design Notion: the artifact's bundle rebuilt from the changed source; `bundle.css` rebuilt with the recorded
  recipe came out byte-identical (no new classes). The Command preview shows `label`, `wrapperClassName="h-12"` and a
  trailing `Kbd` "Esc"; rendered with Playwright in light and dark: the field is named, the row is 48 px, the key sits
  12 px from the row's right edge, no console errors.
- Gates: typecheck, theme-notion tests (810), language gate on every commit; full `npm test` in the pre-push hook.

## Before the next release

- Nothing beyond the coordinator's batch release of theme-notion (minor-safe: additive props).
