---
change_id: theme-notion-sft-bridge-everywhere
title: "theme-notion: ui's --sft-* tokens take the Notion theme inside and outside PageFrame (issue #1260)"
status: open
roadmap_item: null
issue: 1260
branch: claude/project-thread-0gxvid
created: 2026-11-16
updated: 2026-11-16
---

## Intent

A screen built from `@softure-ai/ui` components (a chat screen from #1259, a form, a card) in a theme-notion app takes
the Notion colours, fonts, radii and shadows wherever it sits, not only inside a `PageFrame`. Today the bridge
re-points `--sft-*` only under `[data-page-frame]`, so a chat panel inside the app shell keeps ui's default look.

## Context

Follow-up of the concept check #1248 (`context/archive/2026-11-16-ai-sdk-ui-concept-check/research.md`, section 4).
Labels: `enhancement`, `pkg: theme-notion`. `themes/theme-notion/src/sft-bridge.css`; theme-flat-paint's bridge
already applies on every scheme scope (`:root, .light, .dark, [data-theme]`).

## Constraints

- No API change; `PageFrame` keeps working and keeps its body rule.
- Visual tests of ui's chat primitives in both schemes (needs #1259's components on master).
- The NOTION · Design System artifact stays in step.
- CHANGELOG under `## Unreleased`; the coordinator releases.

## Notes

- Release: ridden by the coordinator's next batch release.
