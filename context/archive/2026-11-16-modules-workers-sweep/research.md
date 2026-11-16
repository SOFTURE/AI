# Research: modules-workers-sweep (RP-7)

## Findings

- **What the guard says today.** With every runtime entry of the RP-7 modules (and the foundation entries they use)
  declared Workers-safe, `tests/repo/workers-entries.test.ts` reports 30 problems in 20 entries (measured
  2026-11-16). They fall into four groups:
  1. `./jobs` entries and anything reaching `@softure-ai/jobs` (alerts `./server` and `./next`, blog `./server`
     through `jobs/enqueue.ts`, mailing, mcp-access, waitlist, files, billing, analytics, metering `./jobs`): jobs has
     no Workers entry until RP-4 (`jobs-scheduled-tick`), which owns it.
  2. `@softure-ai/db` root: migrations, exports and the CLI read files. RP-2 made `@softure-ai/db/request` the
     Workers-safe entry (`getConfiguredDatabase`, `findDriverError`, `isConstraintViolation`, `Queryable`) and noted
     that "module adapters switch to `/request` in RP-7". 15 request-path files in the RP-7 modules import the root.
  3. `node:fs` on paths that a request may reach: files' local driver (`local-storage.ts`) and `saveFile({ path })`
     (`save.ts`), pwa's `getBuildVersion` (reads `.next/BUILD_ID`).
  4. `node:fs` in tooling exported next to request code: blog `readArticleDir` and the quality link resolver
     (CLI helpers exported from `./server` and `./quality`), core `./og` fonts, theme-kit `./build`.
- **workerd provides `node:fs`** (measured with Miniflare 4.20260730, compat date 2026-07-30, `nodejs_compat`):
  `node:fs` and `node:fs/promises` import; `readdir("/bundle")` lists the bundled modules, `/tmp` is writable and
  readable within a request, `existsSync` of a missing path is false. There is no project directory: a file the app
  ships on disk under Node (`.next/BUILD_ID`, a content folder, a font) is not there.
- mailing's DNS checks use `node:dns/promises`, which workerd resolves over DNS-over-HTTPS (RP-5): no change.
  mcp-access uses `node:module` only in `./stdio` (a Node CLI entry): not declared.
- Two runtime detections exist: `isWorkersRuntime()` in `foundation/db/src/request.ts` (navigator.userAgent).
  core `.` is Workers-safe and has the platform contract but no detection.

## Decisions (auto)

- **The guard allows `node:fs` and `node:fs/promises`** with the measured caveat in a comment: the import works,
  the disk is virtual (`/bundle` read-only, `/tmp` per request). The import-level guard cannot tell a CLI helper
  from a request path, and splitting every tooling export into a new subpath would break apps for no runtime gain.
  The rule "no app files on the request path" moves to the code that reads them: each such reader handles Workers
  explicitly and is tested.
- **files:** `createLocalStorage` throws on Workers ("use createS3Storage with an R2 bucket"); `saveFile({ path })`
  returns the same refusal on Workers. The S3 driver already uses `fetch`, web streams and `node:crypto`.
- **pwa:** `getBuildVersion` reads `SOFTURE_BUILD_VERSION` (or the Worker version metadata the app passes) on
  Workers, and keeps `.next/BUILD_ID` on Node.
- **Modules switch request-path imports to `@softure-ai/db/request`** and raise their `@softure-ai/db` range to
  `^0.1.15`. CLIs and scripts keep the root.
- **`isWorkersRuntime` is added to core** (core 0.2.9) for files and pwa. The copies in db and security stay: db
  accepts core `^0.1.0 || ^0.2.0`, and narrowing its range is not worth a release of its own.
- **pwa on Workers:** `getBuildVersion` takes `SOFTURE_BUILD_VERSION` from the environment on both runtimes when it is
  set; on Workers without it, it throws a message naming the variable (a silent `dev` would stop the service worker
  from ever updating). The deploy target (RP-8) sets it.
- **Not declared:** every `./jobs`, `./cli`, `./scripts`, `./stdio`, `./testing` and CSS entry; alerts `./server`
  and `./next` and blog's entries reaching `jobs` wait for RP-4, which declares them once jobs has a Workers entry.
  core `./og` and theme-kit `./build` stay Node-only (out of RP-7's scope).
