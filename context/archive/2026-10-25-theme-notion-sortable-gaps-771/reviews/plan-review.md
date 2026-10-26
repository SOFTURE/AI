---
change_id: theme-notion-sortable-gaps-771
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and issue #771.

- Scope: one component file, its tests, README, CHANGELOG and the design system mirror; every issue point is mapped
  (1 disabled, 2 group, 3 callbacks, 4 activator, 5 `as` + non-sortable children, optional click covered by a test).
- Fit: every behaviour uses a dnd-kit primitive (`disabled`, droppable filtering, sensor listeners, `Slot`), no
  custom collision code. Classes stay unchanged, so the slot snapshot holds.
- Risks: a disabled row must drop the drag attributes, not only the listeners, or it stays a focusable "sortable";
  the plan says so. Groups must also be rechecked in `handleDragEnd`, in case an app changes groups mid-drag.
- Accessibility: keeping the keyboard on the row in `activator` mode is the right trade; the README must say why.
- Tests: behaviour names, exact values, the failure path (cross-group drop, disabled row).

Verdict: approved.
