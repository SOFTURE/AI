---
change_id: marketing-kit-xfade-ffmpeg71-1057
title: "marketing-kit: footage drafts and renders with a fade work on ffmpeg 7.1 (issue #1057)"
status: open
roadmap_item: null
issue: 1057
branch: claude/project-thread-p4tlfr
created: 2026-11-04
updated: 2026-11-04
---

## Intent

Close [issue #1057](https://github.com/SOFTURE/AI/issues/1057): on ffmpeg 7.1 every `renderFootageDraft` and every
`renderFootage` whose cut has a `fade` fails at `xfade` (frame rate 1/0 after `setpts`), and on every ffmpeg a `fade`
right after a zoomed segment fails because the zoomed tail comes back one or two pixels short (1078x1920).

## Context

Labels: bug, pkg: marketing-kit (found in an adopting app on marketing-kit 0.8.0). Since 0.7.0 most jump cuts are
`zoom` or `fade`, so in that app every draft and render fails. No version bump: the coordinator releases.

## Constraints

- Same picture on ffmpeg 6.1 as before (fps on a 30 fps stream is a no-op; the tail keeps the clip's frame).
- No change to an app's repository; migration notes in CHANGELOG.

## Notes

- Framing: skipped. The issue names both causes and a fix verified on 7.1.5 and 6.1.1.
