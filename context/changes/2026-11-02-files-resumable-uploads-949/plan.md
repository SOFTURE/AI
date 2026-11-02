---
change_id: files-resumable-uploads-949
status: in_progress
---

# Plan: resumable uploads (issue #949)

Input: change.md, research.md. Complexity: medium (a table, four server functions, a route, a page, MCP helpers, docs).

## Phase 1: sessions, chunks, finalize (TDD)

Files: `modules/files/migrations/0002_create_uploads.sql`, `src/schema.ts`, `src/options.ts`, `src/contract.ts`,
`src/messages/en.ts`, `src/server/uploads.ts` (new), `src/server/upload-tokens.ts` (new), `src/server/save.ts`
(export the field validation), `src/server/index.ts`, `src/index.ts`, `module.json`, `tests/uploads.test.ts`.

1. Table `files.uploads`: id, owner_id, original_name, content_type, kind, size (>= 1), sha256 (optional), chunk_size,
   received_chunks `integer[]`, file_id (set on finalize), expires_at, created_at, finalized_at. The state
   (`open | complete | finalized | expired`) is derived from those columns, so it can never disagree with them.
2. Options `uploads: { chunkBytes = 64 MiB, ttlSeconds = 1 day (max 7 days), maxOpenPerOwner = 5, contentTypes = null }`
   (`video/*` wildcards allowed). Size cap is `maxFileBytes`.
3. `createUpload(ctx, { ownerId, name, contentType?, size, sha256?, kind?, ttlSeconds? })` → `{ uploadId, uploadUrl,
   chunkSize, chunkCount, expiresAt }`; refuses `invalid_input`, `too_large`, `content_type_not_allowed`,
   `too_many_uploads` (open sessions under an advisory lock), `quota_exceeded` (usage + size), `link_key_*`.
   URL `/u/<id>/<expiry>.<mac>`, HMAC under the link keyring with its own context string.
4. `writeUploadChunk`, `getUpload` (status: received byte ranges, missing chunk indices, state) and
   `finalizeUpload(ctx, uploadId, { ownerId? })`: every chunk present, parts streamed into `saveFile`, size and
   optional sha256 checked (`checksum_mismatch` deletes the file), idempotent, parts removed after.
5. Tests first: create → chunks out of order → resume via status → finalize → same file on a second finalize;
   misaligned and wrong-length chunks refused; a repeated chunk not rewritten; sha256 mismatch; incomplete; limits;
   a missing part in storage; owner filter.

## Phase 2: upload route and browser page

Files: `src/server/serve-upload.ts` (new), `src/server/upload-page.ts` (new), `src/next/upload-route.ts` (new),
`src/next/index.ts`, `src/index.ts` (route `uploads: "/u"`, mount, rate limit bucket constant), `tests/upload-route.test.ts`.

1. `serveUpload(ctx, request)`: token checked before any query (one `404` for every dead URL); `PUT` with
   `Content-Range: bytes a-b/total` (chunk-aligned) or without one when the file fits one chunk, `Content-Length`
   checked up front, body streamed with a cap; `HEAD` answers `upload-received`, `upload-size`, `upload-chunk-size`,
   `upload-state`; `GET` answers the JSON status, or the browser page when the client accepts HTML.
2. Rate limit through `@softure-ai/security` when that module is enabled: bucket `files-upload`
   (`FILES_RATE_LIMIT_BUCKETS`), keyed by the upload; a missing bucket is a setup error.
3. Page: one file input, chunked `fetch` PUTs from the missing chunks, progress; CSP with a nonce, copy from the
   module dictionary.

## Phase 3: prune, privacy, MCP helpers

Files: `src/server/prune.ts`, `src/server/privacy.ts`, `src/mcp/index.ts` (new), `package.json` (export `./mcp`,
optional peer `@modelcontextprotocol/server`), tests.

1. `pruneFiles` also removes expired upload sessions with their parts (`deletedUploads` in the report).
2. Privacy: the export lists the owner's open uploads; the deletion removes them and their parts.
3. `registerFileUploadTools(server, { identity, getContext, getOwnerId? })`: `create_upload` (answer with the URL, a
   ready `curl` loop, the browser page) and `finalize_upload`, registered only when `identity.canWrite`;
   `FILE_UPLOAD_MCP_TOOLS` for the app's catalog.

## Phase 4: docs

README (configuration, mounting the upload route outside the sign-in guard and with an edge bypass for `/u`, the
table, MCP usage, limitations), CHANGELOG `## Unreleased`, the package description.

## Decisions (auto)

- Chunks are separate objects composed by `saveFile` at finalize: works on every driver without a contract change; the
  S3 driver's `put` already uploads multipart.
- The state is derived, not stored: one source of truth, no state transitions to keep in sync.
- The upload URL is signed with the existing link keyring (`SOFTURE_FILES_LINK_KEYS`) under a separate MAC context;
  no new secret.
- Chunks must align to the session's chunk size; a received chunk is not rewritten.
- The MCP helpers live in `@softure-ai/files/mcp`; mcp-access is not changed (strict input and the write switch come
  from the app's factory and `identity.canWrite`).
- Rate limiting is applied when the security module is enabled; without it the route relies on the token.
- `size` must be at least 1 byte.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
