---
change_id: ui-disclosure-panel-links-777
title: "ui: DisclosureMenu panel link rules yield to a link's own classes (issue #777)"
status: open
roadmap_item: null
issue: 777
branch: claude/project-thread-lkia6n
created: 2026-10-26
updated: 2026-10-26
---

## Intent

Close [issue #777](https://github.com/SOFTURE/AI/issues/777): the `DisclosureMenu` panel styles every link inside it
with `[&_a]` rules (class plus element selector). They outrank single-class component rules in the same layer, so a
`ButtonLink` in the panel (e.g. in `AccountMenu`) loses its display, padding and colour. After the change, a
component's own classes win inside the panel; plain links keep today's look.

## Context

- Labels: `pkg: ui` (found adopting `@softure-ai/ui` 0.3.4 in an adopting app).
- The adopting app works around it with four `[&_a]` resets in `classNames.panel`, kept in sync with every
  `ButtonLink` variant.

## Constraints

- Plain links in the panel (`AccountMenu` and `MobileMenu` children) look exactly as before.
- No release in this change: the coordinator releases in a batch.

## Notes

- Framing: skipped. The issue names the cause and two concrete fixes.
