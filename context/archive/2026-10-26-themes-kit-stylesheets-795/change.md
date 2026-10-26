---
change_id: themes-kit-stylesheets-795
title: "Themes ship the kit's page stylesheets as their own (issue #795)"
status: archived
roadmap_item: null
issue: 795
branch: claude/project-thread-oixpsr
created: 2026-10-26
updated: 2026-10-26
archived_at: 2026-10-26
---

## Intent

Close [issue #795](https://github.com/SOFTURE/AI/issues/795): an app imports CSS only from the theme it installs.
Every theme package exports the kit's page stylesheets (`base.css`, and with them `preflight.css` and `maplibre.css`)
under its own name, as one-line re-exports that resolve `@softure-ai/theme-kit` from the theme's own dependency.
The READMEs stop telling the app to import `@softure-ai/theme-kit/*.css`, a package it never declared.

## Context

- Labels: documentation, theme-flat-paint (the same gap in theme-notion, named in the issue).
- Found in an adopting app's audit: its `globals.css` imports `@softure-ai/theme-kit/base.css` with no theme-kit
  entry in its `package.json`; it works only because npm hoists the kit.
- theme-kit 0.1.3 changed `base.css` (#746), so the resolved kit version matters visually.

## Constraints

- Generic, through the theme contract (owner's standing rule): the kit's `softure-theme-css` writes the re-exports
  for every theme; the repository test checks every theme exports them. No per-theme hand-written file.
- No version bump: the coordinator releases. CHANGELOGs under `Unreleased`.
- theme-notion must stay consistent with the "NOTION · Design System" artifact (project memory).
- theme-flat-paint has parallel changes (#779, #781, #782, #784, #794): merge fresh master before the merge.

## Notes

- Framing: skipped. The issue names the problem and the preferred option (1).
