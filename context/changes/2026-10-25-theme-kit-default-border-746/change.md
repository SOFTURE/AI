---
change_id: theme-kit-default-border-746
title: "theme-kit base.css: default border and outline colour from the theme (issue #746)"
status: planned
roadmap_item: null
issue: 746
branch: claude/project-thread-hs9gk5
created: 2026-10-25
updated: 2026-10-25
---

## Intent

Close [issue #746](https://github.com/SOFTURE/AI/issues/746): under Tailwind's full preflight, a `border` without a
colour class draws in `currentColor`, so theme-notion's table rows, accordion items, default alerts, the command
input, item media and sheets draw dark lines in the text colour. shadcn/ui fixes this with a `globals.css` base rule
(`* { @apply border-border outline-ring/50; }`) that no SOFTURE stylesheet ships. Ship it.

## Context

- Labels: `bug`, `pkg: theme-notion`.
- Found by the visual gallery of #741: a table row's bottom border computes to the foreground, not `--border`.
- Overlaps #735 (PR #745) only in theme-notion's README, CHANGELOG and `tests/theme-css.test.ts`; the implementation
  starts from master once #745 is merged.

## Constraints

- No version bump: the coordinator releases in a batch.
- No new `@import` for apps: the rule rides a stylesheet the README wirings already import.
- No change to the component class strings (the #741 parity fixture stays as it is).

## Notes

- Framing: skipped. The issue names the cause, the rule and the acceptance.
