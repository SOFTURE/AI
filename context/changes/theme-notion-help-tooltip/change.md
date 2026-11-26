---
change_id: theme-notion-help-tooltip
title: "theme-notion: a help tooltip that opens on hover, focus, click and tap (issue #1503)"
status: planned
roadmap_item: null
issue: 1503
branch: claude/project-thread-crcwk2
created: 2026-11-26
updated: 2026-11-26
---

## Intent
theme-notion ships `HelpTooltip`: a "?" icon button with a touch-size target on a phone whose tooltip opens on hover,
focus, click and tap, stays open after a click whatever the pointer did between press and release, closes on Escape,
a press outside, blur and pointer leave, and renders the hint hidden under an id a field points to with
`aria-describedby`. Issue #1503 (`enhancement`, `adoption`, `pkg: theme-notion`).

## Context
theme-notion 0.37.0 offers only `Tooltip`, a thin Radix wrapper. Radix's `TooltipTrigger` closes on pointer down when
open and on every click, and the sidebar's provider opens on hover at once, so an app's "?" that toggles a controlled
tooltip on click closes again when hover opened it between press and release (an adopting app's e2e failed about one
run in five).

## Scope
- New composition `src/notion/HelpTooltip.tsx`, exported from the package root, with its English accessible name in
  `messages/en.ts` (`helpTooltip.label`) and a `label` prop.
- Unit tests (the press, leave, re-enter, release race red first against a plain toggling tooltip), the gallery case,
  the class fixture, the visual baselines, README, CHANGELOG `Unreleased`, the "NOTION · Design System" artifact.
- Out of scope: changing `Tooltip` / `TooltipTrigger` themselves (shadcn parity); the adopting app.

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: the issue names the problem, the cause in Radix and the proposed component.
