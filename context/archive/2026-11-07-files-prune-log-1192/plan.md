---
change_id: files-prune-log-1192
status: done
---

# Plan: log what files.prune removes (issue #1192)

Input: change.md, research.md. Complexity: small.

## Phase 1: code

- `server/prune.ts`: `PruneFilesReport.removedFileIds` (the ids of the first `PRUNE_REPORT_MAX_FILE_IDS` = 10 removed
  files, in removal order), so a large run keeps a bounded report.
- `jobs/index.ts`: `FilesJobsLogger` (`info(message, fields)`, a subset of observability's `Logger`), a console
  default writing `@softure-ai/files: <message> key=value ...`, `createFilesJobHandlers({ logger })`;
  `filesJobHandlers` stays as `createFilesJobHandlers()`. The handler logs `files.prune finished` with `removed`,
  `freedBytes`, `failedFiles`, `deletedUploads`, `failedUploads`, and `fileIds` only when `removed <= 10`.

## Phase 2: tests (written first, failing without the change)

- one expired file: the recorded line has `removed: 1`, its `freedBytes` and `fileIds: [id]`;
- nothing expired: `removed: 0, freedBytes: 0`;
- eleven expired files: `removed: 11` and no `fileIds`; the report holds 10 ids;
- the console default prints one `key=value` line;
- existing report assertions gain `removedFileIds`.

## Phase 3: docs

- README (retention), CHANGELOG `## Unreleased`.

## Acceptance

- The issue's three acceptance cases are tests and pass.
- Gates: typecheck, lint, tests.

## Decisions (auto)

- A structural logger like `@softure-ai/jobs`' instead of a dependency on observability: an app passes
  `createLogger("files")` as it is; the package stays free of OpenTelemetry.
- The report carries at most 10 ids, not all: the handler needs only those, and a big run stays small in memory.

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
