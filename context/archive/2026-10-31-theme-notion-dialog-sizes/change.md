---
change_id: theme-notion-dialog-sizes
title: "theme-notion: dialog sizes for a centred popup and a small one"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-deiuab
created: 2026-10-31
updated: 2026-10-31
archived_at: 2026-10-31
---

## Intent

An adopting app's owner finds its edit dialogs read as a new screen, not as a popup: the app stretched
`DialogContent` over the whole viewport because the theme had no larger size than `wide` (half the width, height by
content). Give `DialogContent` two more sizes so an app picks a popup by what it shows:

- `lg`: the standard popup for a form or a list, centred with a quarter of the viewport free on every side from
  `lg` (half the width, half the height), three quarters from `sm`, and the 1 rem gutter on a phone; a fixed
  height whose content scrolls.
- `sm`: a small popup for little data (a short note, one field), narrower than the default, height by content.

## Context

Owner's order of 2026-10-31 (an adopting app's thread): fix it in the package directly, release it and bump the app.
No issue is filed (the owner's order). theme-notion ships alone in this release.

## Constraints

- Backwards compatible: `default` and `wide` render the same classes.
- Every changed line of `src/ui` is listed in `tests/upstream/deltas.ts`.
- Sizes from the Tailwind scale and fractions only; no new token.

## Notes

- Framing: skipped. The owner named the sizes and the acceptance.
