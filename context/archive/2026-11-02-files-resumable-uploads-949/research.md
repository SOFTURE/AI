# Research: resumable uploads in files (issue #949)

## Today (master `c9380e5`)

- `modules/files` 0.1.2: table `files.files` (migration 0001), `saveFile(ctx, { body | path })` streams a body into
  the driver while hashing and counting it (`meterBody`), checks `maxFileBytes` and the per-owner quota (advisory lock
  `files:<owner>`), opt-in dedupe, then inserts the row.
- Drivers (`FileStorage`): `put(body, key)` is atomic (local: partial file + rename; S3: multipart upload through
  `splitIntoParts`; memory). Keys must match `^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*$` (local driver check).
- Links: `/f/<id>/<expiry>/<generation>.<mac>/<name>`, HMAC-SHA256 under `SOFTURE_FILES_LINK_KEYS` (`readLinkKeyring`,
  first key signs, every key verifies, compared in constant time), verified before any query. The route
  `serveFileLinkRoute` is mounted at `app/f/[...link]/route.ts` and documented as outside the sign-in guard and the
  edge sign-in (README §4).
- `pruneFiles` removes expired and deleted files; the `files.prune` job runs it. The privacy contributor exports and
  deletes an owner's files.
- `@softure-ai/security/server`: `consumeRateLimit(ctx, { bucket, key })`, `subjectKey(subject)`; buckets come from
  `security({ buckets })`. mcp-access exports `MCP_RATE_LIMIT_BUCKETS` for an app to spread, and throws when its bucket
  is missing.
- mcp-access: an app's MCP server factory receives `McpServerIdentity { userId, canWrite, tokenId }`; write tools are
  registered only when `canWrite`; `createMcpServerFactory({ strictToolInput })` wraps every registered tool's input as
  strict; the catalog (`mcpAccess({ tools })`) must list every tool (`expectToolCatalogMatchesServer`). The SDK is
  `@modelcontextprotocol/server` ^2.

## Findings

- No new driver method is needed: a chunk can be stored as its own object (`uploads/<id>/<index>`) with `put`, and
  `finalizeUpload` can stream the parts in order into `saveFile`, which re-hashes, counts, applies the quota and dedupe
  and writes one final object (S3: multipart through the driver's own `put`). The cost is one extra copy of the bytes
  in storage at finalize, accepted for a driver-agnostic design.
- With a fixed chunk size and chunk-aligned ranges, "received ranges" reduce to a set of chunk indices, which one
  conditional `UPDATE` keeps race-free across parallel `PUT`s.
- A received chunk is never rewritten (a repeated `PUT` of it is answered without reading the body), so the parts are
  immutable once recorded and a finalize can read them safely.
- Two concurrent finalizes: the second sees `file_id` set by a conditional `UPDATE … WHERE file_id IS NULL`; the loser
  deletes its own copy and answers the winner's file.
- Next.js App Router route handlers do not cap request bodies; the proxy limit is the edge's (Cloudflare 100 MB on
  Free/Pro), so 64 MiB chunks fit.
- The MCP helper can live in `@softure-ai/files/mcp` with the SDK as an optional peer; mcp-access needs no change
  (strict input and the write switch are applied by the app's factory and `identity.canWrite`).
