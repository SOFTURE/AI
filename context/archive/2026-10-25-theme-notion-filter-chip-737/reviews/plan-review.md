---
change_id: theme-notion-filter-chip-737
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and issue #737.

- Scope: one new composition file in theme-notion, a message key, the export, tests and docs; no other package.
- Reuse: built on the package's own `DropdownMenu`, so the popover look and keyboard handling are not re-drawn.
- Risks: an active pill's hover would turn grey; keep the blue tag on hover when active. Children that are not menu
  items lose arrow-key focus; the README says to pass `DropdownMenu` items.
- Tests: cover every acceptance item (active attribute, label and value, content opens) plus the add pill's copy.

Verdict: approved, with the two risk notes folded into the implementation.
