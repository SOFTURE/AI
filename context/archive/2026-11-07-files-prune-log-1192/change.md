---
change_id: files-prune-log-1192
title: "files: the files.prune job logs what it removed (issue #1192)"
status: archived
roadmap_item: null
issue: 1192
branch: claude/project-thread-iq9lsm
created: 2026-11-07
updated: 2026-11-07
archived_at: 2026-11-07
---

## Intent

Close [#1192](https://github.com/SOFTURE/AI/issues/1192): `filesJobHandlers["files.prune"]` discards the report of
`pruneFiles`, so operators cannot see what a run removed. Every run logs one line, also when nothing was removed:
`removed`, `freedBytes`, `failedFiles`, `deletedUploads`, `failedUploads`, and the ids of the removed files when there
are at most 10 of them.

## Context

Labels: `pkg: files`. The thread releases files after the coordinator's go (batched with other files fixes).

## Constraints

- `pruneFiles` stays compatible: the report only gains a field.
- No test talks to an external service.

## Notes

- Framing: skipped. The issue names the fields, the 10-id bound and the acceptance cases.

## Done

The `files.prune` job logs every run: `files.prune finished` with `removed`, `freedBytes`, `failedFiles`,
`deletedUploads`, `failedUploads`, and the removed ids as `fileIds` when at most 10 went;
`createFilesJobHandlers({ logger })` takes an observability logger. `PruneFilesReport.removedFileIds` keeps the first
10 ids (#1192). Next files release.
