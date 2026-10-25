---
change_id: theme-notion-mark-popover-725
title: "theme-notion: MarkPopover, a counted tag that opens a list on the Popover API (issue #725)"
status: in_progress
roadmap_item: null
issue: 725
branch: claude/project-thread-az7npq
created: 2026-10-25
updated: 2026-10-25
---

## Intent

Close [issue #725](https://github.com/SOFTURE/AI/issues/725): add `MarkPopover` to `@softure-ai/theme-notion`, a
counted tag (`badgeVariants({ variant: "tag", color })` with an icon and a count) that opens the design system's
popover listing entries. It runs on the browser's Popover API (no client state, no portal), uses phrasing elements
only, sits in the top layer, and keeps an enclosing `<details>` from toggling on a click on its text. The look must
be identical to the issue's reference implementation, so an adopting app can drop its own copy.

## Context

Labels: `enhancement`, `pkg: theme-notion`, `adoption`. Found on the first app moving to the theme. Related: #718.
No release in this change: the coordinator releases theme-notion.

## Constraints

- The API and markup follow the issue: `data-slot="mark"` and `data-slot="mark-popover"` kept, `span` elements
  only, `buttonData` on the button.
- English only; built-in copy stays props (`label`, `heading`, `closeLabel`), as in the rest of the package.
- Generic through the theme package contract: the file lives in a `softureTheme.sources` folder (`./notion`), so
  `theme.css` generates its classes with no change to `@softure-ai/theme-kit`.

## Notes

- Framing: skipped. The issue gives the problem, the API, a reference implementation and the acceptance.
