---
change_id: theme-flat-paint-look-maps-782
title: "theme-flat-paint: look maps for Hint, Checklist, Stepper, the menu panel and ColorField (issue #782)"
status: in_progress
roadmap_item: null
issue: 782
branch: claude/project-thread-j7mwlv
created: 2026-10-26
updated: 2026-10-26
---

## Intent

Close [issue #782](https://github.com/SOFTURE/AI/issues/782): an adopting app still carries the Flat Paint deltas over
five `@softure-ai/ui` components in its own code. Move them into the theme as one slot map per component
(`HINT_LOOK`, `CHECKLIST_LOOK`, `STEPPER_LOOK`, `MENU_PANEL_LOOK`, `COLOR_FIELD_LOOK`), so a second app gets the same
look without copying class strings.

## Context

- Labels: `enhancement`.
- Parallel work: #777 (ui, link specificity in the `DisclosureMenu` panel) merges first; #779, #780, #781, #784
  change the same package. Merge fresh master before merging.

## Constraints

- Look maps only (class strings and one gap); no ui change, no component; English only; no version bump (the
  coordinator releases).
- Maps hold only what differs from ui's defaults; app-specific motion (a wizard's step stamp) stays in the app.

## Notes

- Framing: skipped. The issue lists every delta and the proposed export names.
