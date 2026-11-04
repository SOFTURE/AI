---
change_id: theme-notion-aside-panel-1044
title: "theme-notion: AsidePanel, a content panel slid in from the right of the app shell (issue #1044)"
status: open
roadmap_item: null
issue: [1044]
branch: claude/project-thread-tmx18r
created: 2026-11-04
updated: 2026-11-04
---

## Intent

Close [issue #1044](https://github.com/SOFTURE/AI/issues/1044): an adopting app built a panel that slides in from the
right edge of its app shell, beside the content, and folds the left sidebar while it is open. Ship it as a common part
of `@softure-ai/theme-notion`: `AsidePanelProvider` (kept state through `initialState` and `save`), `AsidePanelToggle`,
`AsidePanel` (an `aside` on wide screens, a right `Sheet` on a phone, two widths, Escape, focus),
`AsidePanelSidebarOpener` and the `isOverlayOpen(root)` helper, with copy through `notionMessages` (`asidePanel.*`).

## Context

Labels: `enhancement`, `pkg: theme-notion`. Differs from `SidePanel` (#724), a non-modal panel over a canvas: this one
is a column of the app shell next to `SidebarInset`. Checked first: no `aside-panel` slot in the NOTION · Design System
artifact bundle, no open or merged pull request for #1044, no other open issue.

## Constraints

- Backwards compatible: new exports and a new `asidePanel` key in the English dictionary only.
- The panel does not know what it holds; the app passes a lazily loaded child.
- No version bump: the package joins the coordinator's batched release.
- CI workflows are not touched (another thread optimises them).
- The design system artifact is synced after the pull request is green.

## Notes

- Framing: skipped. The issue names the parts, the behaviour and the API.
