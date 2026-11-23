---
change_id: theme-notion-overlay-leaves-with-content
title: "theme-notion 0.30.1: a modal's overlay leaves together with its content"
status: archived
roadmap_item: null
branch: claude/overlay-leaves-with-content
created: 2026-11-23
updated: 2026-11-23
archived_at: 2026-11-23
---

## Intent
An adopting app's end-to-end test of a confirmation dialog failed on a slow CI runner: after Cancel, the test reopened
the same `AlertDialog` and could never click its confirm button, because an open overlay lay above the dialog and
took every pointer event. The same can happen to a person who cancels and reopens quickly. A modal must stay usable
however fast it is reopened.

## Context
Radix's `Dialog.Portal` wraps each child (overlay, content) in its own `Presence` and portal, each unmounted when its own
exit animation ends. The theme's content exits in 200 ms (`duration-200`; the sheet's panel in 300 ms), the overlay in
the animation's default (150 ms). Reopened in that gap, the overlay mounts a new portal appended to `<body>` after the
still-mounted content; both are `z-50`, so the overlay paints above the dialog. Reproduced in Chromium with the
animations slowed down (CDP `Animation.setPlaybackRate`): the confirm button is covered by `[data-slot=alert-dialog-overlay][data-state=open]`.

## Decisions (auto)
- The overlay takes its content's exit duration (`duration-200` on `Dialog` and `AlertDialog`, `data-[state=closed]:duration-300`
  on `Sheet`), so both portals leave in the same animation frame and a reopen always mounts them in order. No z-index
  change: a raised content layer would sit above popovers and selects opened inside it.
- Patch version 0.30.1 (a fix, no API change); it also ships the unreleased `DocumentViewer` title fix.

## Notes
- research skipped: the cause was measured in the adopting app's browser test and read in Radix's `DialogPortal`; three overlay lines are all it touches.
- frame skipped: a reproduced defect with one cause.

## Done
0.30.1 in the package; `tests/behaviour/overlays.test.tsx` checks that each modal's overlay exits with its content
(red before the fix), the upstream deltas and the parity fixture follow, CHANGELOG updated.
