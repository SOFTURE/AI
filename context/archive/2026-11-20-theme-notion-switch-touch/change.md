---
change_id: theme-notion-switch-touch
title: "theme-notion 0.30.0: touch-sized Switch for phone views"
status: archived
roadmap_item: null
branch: claude/switch-touch-size
created: 2026-11-20
updated: 2026-11-20
archived_at: 2026-11-20
---

## Intent
An adopting app moves forms with switches (publication settings) to the phone. Every tapped control there must reach
the theme's touch target (44 x 44 px), as `Button`, `Select`, `Tabs` and `TabBar` already can; `Switch` is 26 x 16 and
had no touch size, so the app could only make its label the tap target.

## Decisions (auto)
- `Switch size="touch"` makes the root a 44 x 44 square (`size-touch-target`, `data-size="touch"`) that draws the same
  26 x 16 track as a `before:` layer and moves the 12 px thumb 5 px either side of the centre; the focus ring moves to
  the track. The default and `sm` sizes render the same markup as before.
- Negative margins (`calc` on the `touch-target` token) keep the switch's place in the layout at the track's size, so a
  row does not grow; `className="md:m-0 md:h-4 md:w-[26px]"` brings the plain switch back on a desktop.
- No gallery case and so no new visual baselines (as for the TabBar touch size): the class behaviour is locked by unit
  tests and the geometry by the adopting app's phone e2e on the real build.
- Minor version (0.30.0): a new size, no change for existing callers.

## Notes
- research skipped: one component, its upstream delta, its behaviour tests and the README's touch-size section.
- frame skipped: the need is the documented touch-size rule applied to one more control.

## Done
0.30.0 in the package; `tests/behaviour/controls.test.tsx` covers the unchanged default, the touch square and track,
the desktop restore class and the thumb; the upstream delta lists the change; README "Touch sizes" and the CHANGELOG
follow.
