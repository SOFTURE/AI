# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/files`. When an app has run a version
in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- First version (#888): the module `files` with the table `files.files` (owner, SHA-256, size, content type,
  sanitised name, kind, expiry, soft delete, link generation); `saveFile` from a stream or a path, hashed and counted
  while written, never buffered, with `maxFileBytes`, a per-owner quota under an advisory lock and opt-in dedupe;
  `findFile`, `openFile` (byte ranges), `listFiles`, `deleteFile`, `getOwnerUsage`; storage drivers
  `createLocalStorage` (atomic rename, free space for the health check) and `createS3Storage` (SigV4, multipart
  uploads; R2, MinIO, Garage, AWS); public links `createFileLink` / `revokeFileLinks` signed with
  `SOFTURE_FILES_LINK_KEYS`, served by `serveFileLinkRoute` (`GET`, `HEAD`, `206` and `416`, `Content-Disposition`,
  `Cache-Control: private, no-store`, one `404` for every dead link); `pruneFiles` and the hourly `files.prune` job;
  a privacy contributor; a health check; `/testing` with an in-memory driver and link checks.
