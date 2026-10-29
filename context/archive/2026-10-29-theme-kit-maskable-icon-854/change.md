---
change_id: theme-kit-maskable-icon-854
title: "theme-kit: maskable app icons, glyph scale and stroke width for PWA manifests (issue #854)"
status: archived
roadmap_item: null
issue: 854
branch: claude/project-thread-g8z0qq
created: 2026-10-29
updated: 2026-10-29
archived_at: 2026-10-29
---

## Intent

Close [issue #854](https://github.com/SOFTURE/AI/issues/854): `drawAppIcon` (`@softure-ai/theme-kit/next`, #839) has
only the `rounded` and `square` shapes and a fixed glyph scale and stroke, so an installable app cannot draw its web
app manifest icons with it. Add a `maskable` shape (full bleed, glyph inside the W3C 80 % safe zone), optional
`glyphScale` and `strokeWidth` options, and README examples for the manifest icons (192, 512, maskable 512) served
from a route handler.

## Context

Labels: `enhancement`, `pkg: theme-kit`. Follows #839 (theme-kit 0.1.5). No release in this change: the coordinator
releases theme-kit as a patch (themes depend on `^0.1.x`).

## Constraints

- Generic through the theme contract: no theme-specific code (the stroke width is a number the app passes, e.g.
  theme-notion's `ICON_STROKE_WIDTH + 0.5`).
- Backwards compatible: the existing defaults (62.5 % glyph, stroke 2) stay for `rounded` and `square`.

## Notes

- Framing: skipped. The issue names the gap, the app's workaround and the proposed options.
