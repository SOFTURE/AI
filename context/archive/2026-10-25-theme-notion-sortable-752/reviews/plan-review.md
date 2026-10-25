---
change_id: theme-notion-sortable-752
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and `themes/theme-notion` on master 422fac9.

- Scope: every ask of the issue is covered: the lifted look as `data-dragging` styles, the touch hold defaults
  (500 ms, 8 px, no selection or callout), localisable announcements and instructions, an optional handle.
- The dependency is the one the adopting app already ships, so its bundle does not grow; it is headless, so the look
  stays in theme tokens. The sortable preset's peer on core is satisfied by the pinned ranges.
- Tailwind: the file sits under `src/notion/`; every class is a literal, `data-[dragging]` included.
- Accessibility: in row mode the `<li>` keeps `role="listitem"` instead of dnd-kit's default `button`, so list
  semantics survive; it gets `aria-roledescription` and the instructions as its description. The handle is a real
  button with a name.
- SSR: `"use client"` and a stable `DndContext id` avoid a hydration mismatch in the describedby ids.
- Tests cover keyboard reorder, cancel, both modes and the copy.

Verdict: approved, no changes.
