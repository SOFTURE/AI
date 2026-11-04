---
change_id: marketing-kit-draft-copy-1051
title: "marketing-kit: a draft render with crf keeps its picture in the final pass (issue #1051)"
status: archived
roadmap_item: null
issue: 1051
branch: claude/project-thread-1yj955
created: 2026-11-04
updated: 2026-11-04
archived_at: 2026-11-04
---

## Intent

Close [issue #1051](https://github.com/SOFTURE/AI/issues/1051). With `quality: "draft", crf: 18` hyperframes encodes
with libx264 `ultrafast`, which writes H.264 Constrained Baseline. `finishFootage` copies the picture only for H.264
High, so it re-encodes the whole film at `medium` (about 320 s of a 858 s run). After this change H.264 yuv420p in
Constrained Baseline, Main or High is publishable, the picture is copied, and the run takes about 540 s.

## Context

Labels: `bug`, `pkg: marketing-kit`. Files: `tools/marketing-kit/src/footage/publish.ts` (+ test),
`src/footage/pipeline.ts` (the finish log line), `src/cli/footage.ts` (the summary line), README, CHANGELOG.
Related: #1036 (added `crf`), #899 (the final pass).

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- A picture that is not publishable is still re-encoded to H.264 High, as before.
- English only; the adopting app is not changed.

## Notes

- Framing: skipped. The issue names the cause, the measurement and two directions.
