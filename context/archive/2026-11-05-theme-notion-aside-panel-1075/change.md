---
change_id: theme-notion-aside-panel-1075
title: "theme-notion: AsidePanel toggle icon, phone-safe server render, hover hints, sheet description (issue #1075)"
status: archived
archived_at: 2026-11-05
roadmap_item: null
issue: [1075]
branch: claude/project-thread-rgv02u
created: 2026-11-05
updated: 2026-11-05
---

## Intent

Close [issue #1075](https://github.com/SOFTURE/AI/issues/1075), a follow-up to #1044 found while an adopting app moved
its side panel onto `AsidePanel`:

1. `AsidePanelToggle` takes an optional `icon`, so an app can show the icon of the tool its panel holds.
2. The wide-screen `aside` is hidden below the `md` breakpoint by CSS, so a phone that receives it in the server HTML
   (with a kept open panel, before hydration swaps in the sheet) never paints it.
3. The toggle, the width switch and the sidebar opener set `title` from the same labels as their `aria-label`.
4. `AsidePanel` takes an optional `description`, shown in the phone sheet and wired to `aria-describedby`.

## Context

Labels: none beyond the package. Owns `@softure-ai/theme-notion` only. No other open pull request touches the package.

## Constraints

- Backwards compatible: new optional props and one extra class on the `aside`.
- Released on its own right after the merge (coordinator's brief), as a minor bump (new props).

## Notes

- Framing: skipped. The issue names each gap and the wanted API.
