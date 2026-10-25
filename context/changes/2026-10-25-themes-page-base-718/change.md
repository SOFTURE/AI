---
change_id: themes-page-base-718
title: "theme-kit: page base and MapLibre font stylesheets for apps with SOFTURE package pages (issue #718)"
status: in_progress
roadmap_item: null
issue: 718
branch: claude/project-thread-wve3hx
created: 2026-10-25
updated: 2026-10-25
---

## Intent

Close [issue #718](https://github.com/SOFTURE/AI/issues/718): an adopting app on `@softure-ai/theme-notion` keeps two
style rules of its own (the page base on `body`, and the theme font on MapLibre maps). The theme packages ship them,
so the app's `globals.css` holds only `@import` lines.

## Context

- Labels: `pkg: theme-notion` (found adopting theme-notion 0.1.1 and theme-kit 0.1.1).
- The scoped `preflight.css` reaches only `[data-slot]` subtrees, so `body` keeps the browser's margin, serif font,
  black text and white background; Radix portals on `body` inherit them.
- `maplibre-gl.css` is unlayered and sets its own font family on `.maplibregl-map`.

## Constraints

- Generic through the kit (owner's rule for themes): the rules read only contract tokens, so every theme gets them.
- No change for apps that do not import the new files.
- No release in this change: the coordinator releases in a batch.

## Notes

- Framing: skipped. The issue names the outcome and the exact rules.
