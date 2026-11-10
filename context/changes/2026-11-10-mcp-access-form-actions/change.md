---
change_id: mcp-access-form-actions
title: "mcp-access: TokenManager buttons keep their own width"
status: in_progress
roadmap_item: null
issue: null
branch: fix/mcp-access-form-actions
created: 2026-11-10
updated: 2026-11-10
---

## Intent

`TokenManager` stretches its buttons across the whole page: the token forms are flex columns, so the "Create token"
submit, the issued panel's "Open in Claude Code" link and its "Done" button take the full width. A button should be
as wide as its label, as in every other form of the theme. Put the buttons in an `actions` slot (a row), the slot
the other packages (billing, connections) already use for their buttons.

## Context

Found by an adopting app whose owner asked for a normal-size "Create token" button on its assistant page. The owner's
standing order: a gap in a package is fixed in the package, released and bumped in the app, with no issue filed.

## Constraints

- No API break: a new optional slot in `classNames`; everything else renders as before.
- The revoke and copy buttons already sit in a row (`itemHeader`) and stay as they are.

## Notes

- Research: skipped. One component, read in full; the cause (flex column children stretch) is in `token-manager.tsx`.
- Framing: skipped. A layout defect with an obvious fix; nothing in doubt.
