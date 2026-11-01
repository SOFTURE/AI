---
change_id: theme-notion-top-loading-bar-923
title: "theme-notion + pwa: a thin top loading bar for wide screens next to LaunchScreen (issue #923)"
status: open
roadmap_item: null
issue: [923]
branch: claude/project-thread-gauslc
created: 2026-11-01
updated: 2026-11-01
---

## Intent

Close [issue #923](https://github.com/SOFTURE/AI/issues/923): `LaunchScreen` covers and blocks the whole screen while
a route loads, which is right on a phone or in an installed app and in the way on a desktop. Give apps a thin,
non-blocking bar at the top for wide screens, an indeterminate `Progress` for a load of unknown progress, a way for the
pwa counter to drive an element other than the launch screen, and a component that picks the loading state in the
browser so `app/loading.tsx` stays static.

## Context

Labels: `pkg: theme-notion`, `pkg: pwa`. Builds on #911 (LaunchScreen, the counter script) and #871. Checked first
that no other session shipped it: no `TopLoadingBar`, `rootSlot` or indeterminate fill on master (3bb947e), no open or
merged pull request for #923. No version bump: both packages join the coordinator's batched release.

## Constraints

- Backwards compatible: new exports, new optional option; `Progress` with a value draws exactly as before.
- The counter script stays self-contained (it runs from its text).
- The design system artifact is synced by a separate thread, not here.

## Notes

- Framing: skipped. The issue names the parts and the behaviour.
