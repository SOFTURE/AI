---
change_id: theme-notion-safe-area-851
title: "theme-notion: overlays and frames take the screen's safe-area insets (issue #851)"
status: in_progress
roadmap_item: null
issue: 851
branch: claude/project-thread-rxbgp4
created: 2026-10-28
updated: 2026-10-28
---

## Intent

Close [issue #851](https://github.com/SOFTURE/AI/issues/851): with `viewport-fit=cover` (an app installed on a phone's
home screen), the parts of `@softure-ai/theme-notion` that touch a screen edge pad by `env(safe-area-inset-*)` on the
edges they touch, so an app no longer patches `SheetContent`, the mobile `Sidebar`, `SelectContent` and `PageFrame`
through `className`.

## Context

Labels: `pkg: theme-notion`. Found by an adopting app installed as a home-screen web app. The insets are 0 on a desktop
and in a browser with its own bars, so nothing changes there. The change is mirrored in the "NOTION · Design System"
artifact. No release in this change: the coordinator releases.

## Constraints

- Tokens and Tailwind utilities only; arbitrary values limited to `env(safe-area-inset-*)`.
- Every `src/ui` change is a listed upstream delta (`tests/upstream/deltas.ts`).
- No layout change where the insets are 0.

## Notes

- Framing: skipped. The issue names the problem, the parts and the approach.
