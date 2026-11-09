---
change_id: marketing-kit-travel-overlays
title: "marketing-kit: travel overlay kinds, style knobs and fonts per role (0.24.0)"
status: done
roadmap_item: null
issue: null
branch: claude/marketing-kit-travel-overlays
created: 2026-11-09
updated: 2026-11-09
---

## Intent

An adopting app's travel reels need overlays the kit cannot draw yet: a hook title at the top of the frame with an
optional place and pin, a search bar that types itself, a place card (title and subtitle), a counter that counts up
to a value with a unit, and a small date stamp. Every drawn overlay takes style knobs (card, text and accent colours,
size, position, entrance, typing speed) inside bounds; a missing knob keeps today's look. Overlay text takes the
brand's font per role (heading, interface) with the body font as the fallback.

## Constraints

- An EDL without the new kinds or knobs renders and drafts as before (existing tests unchanged).
- Natural motion only: fade, slide, type or none; no bounce or pop.
- No network at render time; no test talks to an external service.

## Notes

- Framing: skipped. The adopting app's roadmap item names the kinds, the knobs and the bounds.
- No issue: the owner's standing order for this package is to fix gaps directly and release.

## Done

- marketing-kit 0.24.0: five new kinds, style knobs, fonts per role, render and draft alike.
