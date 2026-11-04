---
change_id: marketing-kit-caption-anchor-1026
title: "marketing-kit: captions anchored by their foot and fitted to a line limit (issue #1026)"
status: in_progress
roadmap_item: null
issue: 1026
branch: claude/project-thread-5xu4l6
created: 2026-11-04
updated: 2026-11-04
---

## Intent

Close [issue #1026](https://github.com/SOFTURE/AI/issues/1026). Every caption box is placed by its top edge, so a
highlight pill that wraps to a third line grows down past the platform's safe zone, and nothing limits its lines.
After this change:

1. a caption box can be anchored by its bottom edge (`bottom` in `CaptionLayout` and the `layout` override), so it
   grows upwards and its foot stays put; the 9:16 caption presets anchor the box this way at the zone's edge;
2. a footage film's `captionMaxLines` shrinks a caption's font until the card fits that many lines;
3. the caption text metrics (line height, pill padding) are exported, so an app does not copy them.

## Context

Labels: `enhancement`, `pkg: marketing-kit`. Files: `tools/marketing-kit/src/compose/{timeline,compose}.ts`,
`src/footage/{captions,compose,draft,film}.ts`, `src/config/{schema,config}.ts`, `src/index.ts`, the generated
`schema/marketing.schema.json`, their tests, README, CHANGELOG. Issue #1025 changes the same package in parallel.

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- English only; the adopting app is not changed.

## Notes

- Framing: skipped. The issue measures the gap and names the options.
