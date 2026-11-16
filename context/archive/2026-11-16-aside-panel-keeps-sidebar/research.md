# Research: aside-panel-keeps-sidebar

- The fold lives in two places of `AsidePanelProvider`: `isSidebarShown = isSidebarOpen && !(kept.isOpen && !isMobile && !isHidden)`
  and `openSidebar`, which closes a kept-open panel on a wide screen. `changeSidebar` (the `SidebarProvider`'s
  `onOpenChange`: trigger, Ctrl+B) goes through `openSidebar`.
- `isSidebarFolded` in the context is `!isSidebarShown`; `AsidePanelSidebarOpener` renders only while it is true, so
  with the sidebar kept open it shows only after the user folds the sidebar themselves.
- Phones are unaffected: the sidebar is a sheet there and the fold condition already excludes `isMobile`.
- Tests: `themes/theme-notion/tests/notion/AsidePanel.test.tsx` ("the sidebar handover") cover the default mode.
