---
change_id: files-prune-log-1192
---

# Research

- `modules/files/src/jobs/index.ts`: `filesJobHandlers["files.prune"]` awaits `pruneFiles(ctx)` and returns `ok()`.
- `modules/files/src/server/prune.ts`: `pruneFiles` counts `deletedFiles`, `freedBytes`, `failedFiles` per row
  (`removeMarkedFile` answers whether the bytes and the row went) and adds `pruneUploads`' counts; ids are not kept.
- Other job adapters log through a structural logger: `@softure-ai/jobs` defines `JobsLogger` (`info`, `warn`,
  `error`), "a subset of `@softure-ai/observability`'s `Logger`, so an app passes `createLogger("jobs")` as it is",
  with a console default. `@softure-ai/files` does not depend on observability and logs with `console.error`
  prefixed `@softure-ai/files:` today.
- Observability's `Logger.info(message, fields)` takes string arrays as attributes, so a `fileIds` list fits.
- Tests: `modules/files/tests/prune.test.ts` runs the job through `runDueJobs` from `@softure-ai/jobs/testing` with
  `createTestFiles` (in-memory storage, a fixed clock).
