---
change_id: marketing-kit-footage-speed-1015
title: "marketing-kit: faster footage normalize and cut preview on a small shared worker (issue #1015)"
status: archived
roadmap_item: null
issue: 1015
branch: claude/project-thread-14fjez
created: 2026-11-04
updated: 2026-11-04
archived_at: 2026-11-04
---

## Intent

Close [issue #1015](https://github.com/SOFTURE/AI/issues/1015). On a worker limited to one CPU, `prepareFootage` takes
about 8 min for 1:41 of phone footage and a 50 s cut preview about 5 min. After this change:

1. `buildVideoFilter` drops frames to 30 fps and scales to the frame (crop: cover and crop; blur: fit inside) before
   the float HDR tone map, so the tone map runs on frame-sized pictures; `NORMALIZE_VERSION` is bumped;
2. `buildCutPreviewArgs` seeks each segment with input `-ss`/`-t` instead of `trim` from the clip's start;
3. `FootageRunOptions.normalize?: { preset?, threads? }` lets an app trade the intermediate's size for speed;
4. tests pin the filter order and the per-segment seek arguments.

## Context

Labels: `enhancement`, `pkg: marketing-kit`. Files: `tools/marketing-kit/src/footage/{normalize,render,pipeline}.ts`
and their tests, `src/index.ts`, README, CHANGELOG. Parallel open PRs on the same package: #1016 (#1012, key terms:
`transcribeFootage`, providers, config) and #1017 (#1014, render disk check: `renderFootage`, `tools.ts`). Overlap is
limited to different functions of `pipeline.ts`, `src/index.ts`, README and the CHANGELOG's `## Unreleased`.

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- The cut preview's output is the same frames and length as before; the normalized clips change only slightly.
- English only; the adopting app is not changed.

## Notes

- Framing: skipped. The issue names the bottlenecks with measurements and concrete fixes; research re-measures them.
