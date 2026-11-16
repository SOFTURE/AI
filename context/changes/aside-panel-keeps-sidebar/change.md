---
change_id: aside-panel-keeps-sidebar
title: "theme-notion: AsidePanelProvider can keep the sidebar open beside the panel"
status: new
roadmap_item: null
issue: 1254
branch: claude/aside-panel-keeps-sidebar
created: 2026-11-16
updated: 2026-11-16
---

## Intent

An adopting app wants its left menu and the right `AsidePanel` open at once: opening the panel no longer folds the
sidebar, opening the sidebar no longer closes the panel, and closing either leaves the other as it is. Today's
"one side panel at a time" stays the default.

## Context

`themes/theme-notion/src/notion/AsidePanel.tsx`: `AsidePanelProvider` derives `isSidebarShown` from the kept panel
state and `openSidebar` closes the panel. Issue #1254.

## Constraints

- New optional prop only; every existing app keeps its behaviour (default `false`).
- Tests freeze both modes; README, CHANGELOG, minor bump (0.17.0).
