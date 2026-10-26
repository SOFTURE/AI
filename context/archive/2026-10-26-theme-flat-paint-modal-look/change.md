---
change_id: theme-flat-paint-modal-look
title: "theme-flat-paint: Modal and StandingPanel look (issue #781)"
status: archived
roadmap_item: null
issue: 781
branch: claude/project-thread-kk83kj
created: 2026-10-26
updated: 2026-10-26
archived_at: 2026-10-26
---

## Intent

Close [issue #781](https://github.com/SOFTURE/AI/issues/781): an adopting app stops keeping the Flat Paint dialog
look in its own stylesheet and code. `@softure-ai/theme-flat-paint` ships the entrance keyframes and motion classes in
`page.css` and the slot maps of ui's `Modal` and `StandingPanel` in its look maps.

## Context

- Labels: `enhancement`, `pkg: theme-flat-paint`, `adoption`.
- The look follows the Flat Paint design system: a flat veil (`ink` at 60 %, no blur), panels entering within the
  theme's motion tokens, no scale, no exit animation.

## Constraints

- Only the theme package changes; ui's `Modal` keeps its API.
- No version bump: the coordinator releases.

## Notes

- Framing: skipped. The issue names the outcome and the shape (keyframes in `page.css`, `MODAL_LOOK`,
  `STANDING_PANEL_LOOK`, `getModalLook(width)`).
