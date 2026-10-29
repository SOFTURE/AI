---
change_id: files-module-888
status: archived
---

# Plan: @softure-ai/files (issue #888)

Input: change.md, research.md. Complexity: large (a new module: migration, server core, storage drivers, link route,
jobs adapter, testing entry, docs). Package copied from `templates/package/`, shaped like `modules/connections`.

## Phase 1: package, options, schema, migration

- `modules/files/`: package.json (exports `.`, `./server`, `./next`, `./jobs`, `./testing`), module.json, tsconfigs,
  CHANGELOG (`## Unreleased`), README (twelve sections). Version `0.0.0`.
- Module id `files`, schema `files`, table `files`, `dependsOn: { jobs: "^0.1.6?" }`, env `SOFTURE_FILES_LINK_KEYS`
  (not required: only links need it), route `links: "/f"`, mount `app/f/[...link]/route.ts` → `serveFileLinkRoute`,
  privacy exports and deletes.
- Options: `storage` (a `FileStorage` object, required), `maxFileBytes` (100 MiB), `quotaBytesPerOwner` (null),
  `dedupe` (false), `defaultTtlSeconds` (null), `links: { maxTtlSeconds: 7 days, disposition: "attachment" }`,
  `health: { minFreeBytes: 1 GiB }`.
- Migration 0001: `files` (id, owner_id, sha256, size, content_type, original_name, kind, storage_key unique,
  link_generation, expires_at, deleted_at, created_at; checks on every column; indexes for listing, dedupe, prune).

## Phase 2: storage drivers

- `FileStorage { put(body, key), get(key, range?), head(key), delete(key), check?() }`; keys fan out by the file id
  (`ab/cd/<uuid>`).
- `createLocalStorage({ dir })`: partial file + rename, range reads, `statfs` free space, a probe write for the check;
  nothing touches the disk at creation (`next build`).
- `createS3Storage({ endpoint, bucket, region, accessKeyIdEnv, secretAccessKeyEnv, prefix?, partSizeBytes, fetch? })`:
  SigV4 with `node:crypto`, single `PUT` when the body fits one part, multipart otherwise (aborted on failure).
- `createMemoryStorage()` in `/testing`.

## Phase 3: server functions (TDD on PGlite)

- `saveFile(ctx, { ownerId, body | path, name, contentType?, kind?, expiresAt? | ttlSeconds? })`: hash and count while
  streaming into the driver, cap = min(maxFileBytes, quota left); the row goes in under a per-owner advisory lock with
  the quota re-checked; dedupe returns the owner's live file with the same hash and drops the new blob. Codes:
  `files.too_large`, `files.quota_exceeded`, `files.invalid_input`.
- `findFile`, `openFile` (range), `listFiles`, `deleteFile`, `getOwnerUsage`.
- Links: `createFileLink(ctx, id, { ttlSeconds, downloadName? })` → `/f/<id>/<expiry>/<generation>.<mac>/<name>`, HMAC-SHA256
  over all four parts with the first key; `revokeFileLinks` bumps the generation; `verifyFileLink` (no database);
  `serveFileLink(ctx, request)` (GET and HEAD, ranges, headers, one `404` for every dead link).
- `pruneFiles(ctx)`: expired and deleted files out of storage and the table, in batches.
- Privacy contributor (export lists the owner's files, deletion removes them) and health check (table, storage
  writable, free space).

## Phase 4: adapters, testing entry, docs

- `/next`: `getFilesContext`, `serveFileLinkRoute`. `/jobs`: `files.prune` handler and an hourly schedule.
- `/testing`: `createMemoryStorage`, `createTestLinkKeys`, `fetchFileLink` (status, headers, bytes, with a range or
  `HEAD`), `readFileLinkExpiry`.
- README (edge sign-in bypass for the link route, `@softure-ai/host` `bypassPaths`), CHANGELOG, root README layout
  line, release-tags count.

## Decisions (auto)

- Storage keys come from the file id, not the hash: the hash is known only after the write and S3 has no rename.
  Dedupe works on rows (per owner, opt-in) and drops the duplicate blob.
- The link generation sits next to the MAC in the signature segment (`<generation>.<mac>`), so revocation is one
  integer per file and the MAC is still checked before the database.
- Keyring tried key by key with `timingSafeEqual` (no key id in the URL), the first key signs: rotation like
  `connections`.
- Links answer `attachment` by default with `nosniff` and `Content-Security-Policy: sandbox`: user files never run on
  the app's origin. Several ranges get the whole file (`200`), as RFC 9110 allows.
- Delete marks `deleted_at`, removes the blob, then the row; a failed blob delete is retried by `pruneFiles`.
- No S3 SDK: a SigV4 signer of about a hundred lines, checked against AWS's published test vector.

## Progress

- [x] Phase 1: package, options, schema, migration
- [x] Phase 2: storage drivers
- [x] Phase 3: server functions
- [x] Phase 4: adapters, testing entry, docs; module tests (148)
- [x] Gates: typecheck, lint, test, build
