---
change_id: theme-kit-app-icon-839
title: "theme-kit: an app icon (favicon) helper drawn from the theme tokens (issue #839)"
status: impl_reviewed
roadmap_item: null
issue: 839
branch: claude/project-thread-93ntkg
created: 2026-10-28
updated: 2026-10-28
---

## Intent

Close [issue #839](https://github.com/SOFTURE/AI/issues/839): no `@softure-ai/*` package draws an app icon, so an
adopting app writes theme-specific `app/icon.tsx` / `app/apple-icon.tsx` code of its own (theme token values, a
lucide glyph rendered to static SVG markup first because `next/og` runs no hooks). The kit gets one helper,
`drawAppIcon({ theme, icon, size, tone })`, that works with every theme through the theme contract, plus a README
section on wiring both Next.js metadata files.

## Context

Labels: `enhancement`, `pkg: theme-kit`. Parallel change: #838 (theme-notion Timeline), no shared files. No release in
this change: the coordinator releases.

## Constraints

- Generic: reads only `ThemeDefinition` contract colour roles, follows colour aliases (theme-flat-paint's `primary`
  is an alias), no theme-specific code in the kit.
- The kit root stays free of `next`: the helper lives in a new `./next` subpath; `next` and `react-dom` are optional
  peers.
- Any SVG icon element works (lucide-react 1.x included, whose icons call `useContext`).

## Notes

- Framing: skipped. The issue names the gap, today's workaround and the proposed helper.
