---
change_id: marketing-kit-capture-report-1145
title: "marketing-kit: renderFootage reports hyperframes' capture path and stage timings (issue #1145)"
status: archived
roadmap_item: null
issue: 1145
branch: claude/project-thread-037n3h
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close [issue #1145](https://github.com/SOFTURE/AI/issues/1145): `renderFootage` passes hyperframes' output to
`options.log` only, so an adopting app cannot see from structured data that a render took the slower screenshot
capture path. The rendered value gets `capture: { path, gpu, seconds, fallbackHint }` (null when hyperframes printed
no summary), read from hyperframes' summary line, and the README says that `lowMemory: true` pins screenshot capture.

## Context

Labels: `pkg: marketing-kit`. hyperframes 0.9.6 (pinned). No manifest or lockfile change. No version bump here: the
fix joins the next combined marketing-kit release with #1139, #1140, #1141 and #1143 (coordinator).

## Constraints

- The log keeps every line it gets today.
- A summary hyperframes did not print (or a format it changes) yields `capture: null`, never a failed render.

## Notes

- Framing: skipped. The issue names the gap, the fields and the source line.

## Done

`renderFootage`'s rendered value carries `capture` (`path`, `gpu`, `seconds` per stage, `isEncodeStreamed`,
`fallbackHint`), read from hyperframes' summary line, null when it printed none; `readHyperframesCapture` is exported.
The README says `lowMemory: true` pins screenshot capture (about 30 % slower on one CPU). Ships in the next combined
marketing-kit release.
