---
change_id: marketing-kit-draft-in-pieces
title: "marketing-kit: the footage draft assembled in pieces (default) or in one run, with a memory estimate"
status: archived
roadmap_item: null
issue: null
branch: claude/marketing-kit-draft-in-pieces
created: 2026-11-16
updated: 2026-11-16
---

## Intent

An adopting app's long cut (146 s, 51 segments) failed its footage draft: the worker's 1.5 GB memory cgroup killed
ffmpeg. The draft opens every segment as its own ffmpeg input with its own decoder, so its memory grows with the
number of cuts. The draft gets a second assembly, in pieces joined at the end (default, memory bounded by one piece),
keeps the one-run assembly byte for byte as an option, and exposes an estimate of a draft's peak memory so the app can
warn before a draft its worker cannot hold.

## Context

`src/footage/draft.ts` (`buildFootageDraftArgs`, `renderFootageDraft`); the render's picture already works one segment
per ffmpeg with a stream-copy join (`src/footage/picture.ts`, #1030). Measured in the adopting app: 18 cuts peaked at
1.50 GB, 51 cuts were killed at 1.41 GB anonymous memory of ffmpeg.

## Constraints

- `single` builds exactly today's command (a golden fixture pins it).
- Same frames in both assemblies at every border and transition (fade, whip, card, paper, stutter, split screen).
- Captions burned in once over the joined film; the sound as before.
- Measured memory bound in a test on generated media; no third-party material.

## Notes

- Research and plan below; frame skipped: the owner of the adopting app chose the solution (both assemblies behind
  the app's own switch) on measured evidence.

## Done

- Released as 0.37.0 (see CHANGELOG).
