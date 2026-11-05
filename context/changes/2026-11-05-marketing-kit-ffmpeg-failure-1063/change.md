---
change_id: marketing-kit-ffmpeg-failure-1063
title: "marketing-kit: a failed footage ffmpeg step hands over its command, filter graph and stderr (issue #1063)"
status: in_progress
roadmap_item: null
issue: 1063
branch: claude/project-thread-axnmbe
created: 2026-11-05
updated: 2026-11-05
---

## Intent

Close [issue #1063](https://github.com/SOFTURE/AI/issues/1063): when a footage ffmpeg step fails, the app sees only
`<step>: ffmpeg ended with code N: <last 5 stderr lines>`. It cannot rebuild the arguments, the working folder or the
filter graph, so a failure in a worker cannot be reproduced.

## Context

Labels: enhancement, pkg: marketing-kit (found in an adopting app). Follows #1057, which needed a CI rebuild of the
worker image to find the failing graph. No version bump: the coordinator releases.

## Scope

- `onFfmpegFailure` on every footage entry point that runs ffmpeg: `prepareFootage`, `transcribeFootage`,
  `renderFootageDraft`, `renderFootage`, `renderFootageFilm`, `cutFootageFilm` (and every ffmpeg step they call).
- Exported `FfmpegFailure` and `writeFfmpegFailure(dir, failure, { signal })`: `command.sh`, `filtergraph.txt`,
  `stderr.log`, `inputs.json`.
- One `log` line with the failed step and its full command.

## Constraints

- Without the hook nothing changes; the thrown error text stays as it is.
- No change to an app's repository; CHANGELOG and README describe it.

## Notes

- Framing: skipped. The issue states the problem, the shape of the hook and the acceptance.
