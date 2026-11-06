---
change_id: theme-flat-atlas-1135
title: "feat(theme-flat-atlas): the Flat Atlas design system as a theme package (#1135)"
status: archived
roadmap_item: null
issue: 1135
branch: claude/project-thread-ns73sa
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close #1135. The Flat Atlas design system (a sibling of Flat Paint for travel sites and anything that stands on a
map) exists only as a design artifact with a static stylesheet. The outcome: `@softure-ai/theme-flat-atlas`, a theme
package on `@softure-ai/theme-kit` with the system's tokens, a page stylesheet and its React components, including a
world map projected at build time, ready to publish through `release.yml`.

## Context

Owner request (2026-11-06): build the whole design kit from the accepted design system as a new npm package in this
repository; the owner binds the trusted publisher later, so nothing is released by this change. The first consumer is
an adopting travel site (Vite + React + Tailwind CSS v4).

## Constraints

- English only; components carry no copy of their own: every visible text and accessible name comes from props.
- Flat material: no shadow, glow, gradient or blur anywhere, the map included.
- No release, no tag, no `auto-release` run in this change.

## Notes

- Framing: skipped. The design system artifact fixes the tokens, components and rules; the package contract is
  `themes/theme-kit/README.md`.

## Done

- `@softure-ai/theme-flat-atlas` 0.1.0 (unreleased): tokens, `page.css`, fifteen components and the travel icons
  from the root, `WorldMap` with Natural Earth 1:110m shapes and the runtime projection from `./world-map`
  (`themes/theme-flat-atlas/tests/`, 68 tests).
- Not released. First publish: run `auto-release` with `theme-flat-atlas` once the `NPM_TOKEN` secret is set, then
  bind the trusted publisher on npmjs.com (`scripts/release/README.md`, "First release of a new package").
