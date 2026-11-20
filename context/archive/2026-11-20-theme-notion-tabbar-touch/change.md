---
change_id: theme-notion-tabbar-touch
title: "theme-notion 0.29.0: touch-sized TabBar for phone views"
status: archived
roadmap_item: null
branch: claude/tabbar-touch-size
created: 2026-11-20
updated: 2026-11-20
archived_at: 2026-11-20
---

## Intent
An adopting app moves a screen with a `TabBar` (version tabs as links) to the phone. Every tapped control there must
reach the theme's touch target (44 x 44 px), as `Button`, `Select`, `DropdownMenu` and `Tabs` already can; `TabBar`
had no touch size and takes no class for its links, so the app could only restyle it from outside.

## Decisions (auto)
- `TabBar size="touch"` adds `h-touch-target min-w-touch-target justify-center px-3` to every link and marks it
  `data-size="touch"`, as the other touch sizes do; the default renders the same markup as before.
- `tabClassName` goes on every link after the size, the same pattern as `Button size="touch" className="md:h-7"`, so an
  app keeps its desktop look with one breakpoint class.
- Minor version (0.29.0): new props, no change for existing callers.

## Notes
- research skipped: one component, its existing tests and the README's touch-size section were all that it touches.
- frame skipped: the need is the documented touch-size rule applied to one more control.

## Done
0.29.0 in the package; `tests/notion/TabBar.test.tsx` covers the touch size, the tab class order and the unchanged
default; README "Touch sizes" and the CHANGELOG follow.
