---
change_id: marketing-kit-render-crf-1036
title: "marketing-kit: renderFootage passes hyperframes an encoder CRF (issue #1036)"
status: in_progress
roadmap_item: null
issue: 1036
branch: claude/project-thread-uddpzb
created: 2026-11-04
updated: 2026-11-04
---

## Intent

Close [issue #1036](https://github.com/SOFTURE/AI/issues/1036). A 1-CPU footage worker spends about half its capture
in libx264 `medium` (`quality: "standard"`); the only faster tier, `draft`, publishes CRF 28. After this change
`RenderFootageOptions.crf` passes hyperframes' `--crf`, which overrides the tier's CRF, so an app can render with
`quality: "draft", crf: 18` (libx264 `ultrafast` at CRF 18), measured in the issue at 6.9 s instead of 11.7 s per
second of film.

## Context

Labels: `enhancement`, `pkg: marketing-kit`. Files: `tools/marketing-kit/src/footage/pipeline.ts` (+ test), README,
CHANGELOG. Related: #1030 (merged, added `workers` and `lowMemory` the same way).

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- Optional option only; without it the arguments are exactly as before.
- English only; the adopting app is not changed.

## Notes

- Framing: skipped. The issue names the gap, the flag and the measurements.
