# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/files`. When an app has run a version
in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## 0.4.0

- The `files.prune` job logs every run (#1192): one line `files.prune finished` with `removed`, `freedBytes`,
  `failedFiles`, `deletedUploads`, `failedUploads` and, when at most 10 files went, their ids as `fileIds` (also
  `removed=0 freedBytes=0` for an empty run). `createFilesJobHandlers({ logger })` takes any logger with `info`
  (`createLogger("files")` from `@softure-ai/observability` as it is); `filesJobHandlers` logs to the console.
- `PruneFilesReport.removedFileIds`: the ids of the first `PRUNE_REPORT_MAX_FILE_IDS` (10) removed files.
- Migration: none. A test that compares a whole `pruneFiles` report with `toEqual` adds `removedFileIds`.

## 0.3.0

- `serveStoredFile(ctx, fileId, request, { ownerId, disposition? })` in `/server` and `createStoredFileRoute({ getOwnerId })`
  in `/next` (#993): the signed-in owner gets a stored file with the answer of a link (`GET`, `HEAD`, single byte
  ranges, the same headers, one `404` for anything missing or another owner's), `inline` by default, with no link to
  mint. The route sits behind the app's sign-in guard (README §4.4). `serveFileLink` answers as before.
- Migration for an app that mints a link for its own viewing, or that rebuilt the answer from `findFile`, `openFile`
  and `parseRangeHeader`: mount `createStoredFileRoute` under a guarded prefix and point the player or image at
  `/<prefix>/<file id>`; drop the link minting or the copied answer.
- A browser client, `@softure-ai/files/client` (#988): `sendUpload(file, { uploadUrl, signal, onProgress, fetch })`
  reads the session's `HEAD`, sends only the missing chunks in order with `Content-Range`, reports
  `{ sentBytes, totalBytes }`, honours an `AbortSignal` and answers a `Result` (`files.upload_expired`,
  `files.upload_rejected`, `files.network`, `files.upload_aborted`). `createUploadQueue({ open, finalize })` keeps an
  upload list whose items theme-notion's `UploadItem` takes as they are, with `add`, `retry`, `pause`, `resume`,
  `remove`, `getItems` and `subscribe` (for `useSyncExternalStore`). An app that carries its own chunk loop can drop it.
- The upload page runs the same `sendUpload` (inlined) and says when its link has expired (`uploadPage.expired`).
- New messages for the client's codes: `errors.files.upload_expired`, `upload_rejected`, `network`, `upload_aborted`.
- `registerFileUploadTools` takes `onFinalized(file, ctx)` (#987): it runs after every successful `finalize_upload`,
  a repeated one included, and its returned fields join the answer; a returned `err(code)` answers that code. Also
  `descriptions` (the served text of both tools, defaults exported as `FILE_UPLOAD_TOOL_DESCRIPTIONS`) and `hints`
  (the text answered for an error code). Without them the tools answer as in 0.2.0.
- Migration for an app that wraps the server to replace the finalize handler or the descriptions: drop the wrapper and
  pass `onFinalized` (its step after `finalizeUpload`, made idempotent), `descriptions` and `hints` instead.

## 0.2.0

- Resumable uploads from clients (#949): table `files.uploads` (migration 0002), `createUpload` (a signed upload URL
  under the link keyring, limits `uploads.chunkBytes` 64 MiB, `uploads.ttlSeconds`, `uploads.maxOpenPerOwner`,
  `uploads.contentTypes`, `maxFileBytes` and the quota checked up front), `getUpload`, `writeUploadChunk` and
  `finalizeUpload` (every chunk, size and optional SHA-256 checked, saved like `saveFile`, idempotent).
- The upload route `serveUploadRoute` (`app/u/[...upload]/route.ts`, `GET`, `HEAD`, `PUT`): chunked with
  `Content-Range`, resumable through `HEAD` and the JSON status, streamed with a cap, a browser upload page, and the
  `files-upload` rate limit bucket (`FILES_RATE_LIMIT_BUCKETS`) when the security module is on. Keep `/u` outside the
  sign-in guard and add an edge bypass for it, as for `/f`.
- `@softure-ai/files/mcp`: `registerFileUploadTools` (`create_upload` with a ready `curl` loop, `finalize_upload`),
  `FILE_UPLOAD_MCP_TOOLS` for the catalog, `buildCurlUploadScript`. `@modelcontextprotocol/server` is a new optional
  peer.
- `pruneFiles` also removes expired upload sessions with their chunks (`deletedUploads`, `failedUploads` in its
  report); the privacy export lists open sessions (`uploads`), the deletion removes them (`deletedUploads`,
  `pendingUploads`).
- New dependency `@softure-ai/security` (the rate limit), new error codes `files.content_type_not_allowed`,
  `files.too_many_uploads`, `files.upload_incomplete`, `files.checksum_mismatch` with their messages.

## 0.1.2

- No code change: the first release through the package's npm trusted publisher (OIDC), without `NPM_TOKEN`.

## 0.1.1

- The content of 0.1.0, which was never published: its release stopped at the gates (ESLint ran out of memory in
  `release.yml`) before publishing, and a tag is never moved.

## 0.1.0

- First version (#888): the module `files` with the table `files.files` (owner, SHA-256, size, content type,
  sanitised name, kind, expiry, soft delete, link generation); `saveFile` from a stream or a path, hashed and counted
  while written, never buffered, with `maxFileBytes`, a per-owner quota under an advisory lock and opt-in dedupe;
  `findFile`, `openFile` (byte ranges), `listFiles`, `deleteFile`, `getOwnerUsage`; storage drivers
  `createLocalStorage` (atomic rename, free space for the health check) and `createS3Storage` (SigV4, multipart
  uploads; R2, MinIO, Garage, AWS); public links `createFileLink` / `revokeFileLinks` signed with
  `SOFTURE_FILES_LINK_KEYS`, served by `serveFileLinkRoute` (`GET`, `HEAD`, `206` and `416`, `Content-Disposition`,
  `Cache-Control: private, no-store`, one `404` for every dead link); `pruneFiles` and the hourly `files.prune` job;
  a privacy contributor; a health check; `/testing` with an in-memory driver and link checks.
