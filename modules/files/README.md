# @softure-ai/files

Stored files for a Next.js app that takes uploads or produces media (rendered videos, exports, reports), and public
links that hand one of them to a third party: a social media scheduler that fetches media from a URL, a mail with a
large download, a webhook consumer. The module keeps one table, puts the bytes on a storage driver (a folder on a
volume, or an S3-compatible bucket), and serves links that work without the app's session, serve byte ranges for
video and stop working after their time. A client that cannot hand the server a stream (an assistant in its own
sandbox, a phone behind a proxy with a body limit) uploads through a signed URL in resumable chunks.

## 1. What it provides

- **A table of files** (`files.files`): owner, SHA-256, size, content type, sanitised original name, kind (the app's
  own category, e.g. `input`, `output`), expiry, soft delete.
- **`saveFile(ctx, { ownerId, body | path, name, contentType?, kind?, expiresAt? | ttlSeconds? })`**: the body is
  hashed and counted while it streams into storage, one chunk in memory at a time; `maxFileBytes` stops it at the
  first chunk over, a per-owner quota (`quotaBytesPerOwner`) is checked before and again under a per-owner lock
  after, and with `dedupe` an owner's second copy of the same content answers the first file. A refused or failed
  save leaves no bytes and no row.
- **`findFile`, `openFile` (a byte range or the whole file), `listFiles`, `deleteFile`, `getOwnerUsage`**: live files
  only (neither deleted nor expired); an `ownerId` filter makes another owner's file read as missing.
- **Storage drivers** behind one interface (`put`, `get` with a range, `head`, `delete`, an optional `check`):
  `createLocalStorage({ dir })` (partial file renamed into place, keys fanned out by file id) and
  `createS3Storage({ endpoint, bucket, ... })` for Cloudflare R2, MinIO, Garage or AWS S3 (SigV4 with `node:crypto`,
  single `PUT` or a multipart upload that holds one part in memory). Write your own for anything else.
- **Public links**: `createFileLink(ctx, fileId, { ttlSeconds, downloadName? })` answers
  `https://<app>/f/<id>/<expiry>/<generation>.<mac>/<name>`, an HMAC-SHA256 over every part. The route
  (`serveFileLinkRoute`) checks the MAC and the expiry before any database read, answers `GET` and `HEAD` with
  `Content-Length`, `Accept-Ranges`, `206` for a range, `416` past the end, `Content-Disposition`, and
  `Cache-Control: private, no-store` (no CDN keeps a copy), and the same `404` for an expired, revoked, deleted or
  forged link. `revokeFileLinks(ctx, fileId)` stops every link made so far.
- **Resumable uploads** (`files.uploads`): `createUpload(ctx, { ownerId, name, contentType?, size, sha256?, kind?,
  ttlSeconds? })` opens a session and answers `{ uploadId, uploadUrl, chunkSize, chunkCount, expiresAt }`. The client
  sends the file to `uploadUrl` in chunks under the edge's body limit (64 MiB by default), resumes after a dropped
  connection, and `finalizeUpload(ctx, uploadId)` checks every byte and the optional SHA-256 and saves the file like
  `saveFile` (quota, dedupe). See §4.1.
- **MCP upload tools** (`@softure-ai/files/mcp`): `registerFileUploadTools(server, { identity, getContext })` adds
  `create_upload` (a signed URL, a ready `curl` loop and the browser page) and `finalize_upload`, so an assistant hands
  over a video without its bytes going through a tool call. See §4.2.
- **Retention**: `pruneFiles(ctx)` removes expired and deleted files from storage and the table, and expired upload
  sessions with their chunks; the `files.prune` job (`@softure-ai/files/jobs`) runs it hourly.
- **A privacy contributor** (the export lists the owner's files, the deletion removes them) and **a health check**
  (the table answers, storage takes a write, free space above `health.minFreeBytes`).
- **`/testing`**: an in-memory driver, a fixed link keyring, `fetchFileLink` (status, headers and bytes of a link,
  with a range or `HEAD`) and `readFileLinkExpiry`.

## 2. Installation

```bash
npm install @softure-ai/files
```

`@softure-ai/jobs` is an optional peer, needed only for the prune schedule; `@modelcontextprotocol/server` is an
optional peer, needed only for `@softure-ai/files/mcp`.

## 3. Configuration

```ts
// softure.config.ts
import { files } from "@softure-ai/files";
import { createLocalStorage } from "@softure-ai/files/server";

files({
  storage: createLocalStorage({ dir: "/data/files" }),
  maxFileBytes: 500 * 1024 ** 2,
  quotaBytesPerOwner: 5 * 1024 ** 3,
  dedupe: true,
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `storage` | (required) | the driver: `createLocalStorage`, `createS3Storage`, `createMemoryStorage` (tests) or your own `FileStorage` |
| `maxFileBytes` | 100 MiB | the largest file `saveFile` accepts (`files.too_large` above it) |
| `quotaBytesPerOwner` | `null` (none) | the bytes one owner may keep in live files (`files.quota_exceeded`) |
| `dedupe` | `false` | an owner's save of content they already have (same SHA-256) answers the existing file |
| `defaultTtlSeconds` | `null` (kept) | the lifetime of a file saved without `expiresAt` or `ttlSeconds` |
| `links.maxTtlSeconds` | 7 days | the longest lifetime `createFileLink` grants |
| `links.disposition` | `attachment` | `attachment` (a download) or `inline` (shown by the browser) |
| `health.minFreeBytes` | 1 GiB | the health check fails below this many free bytes (local disk only) |
| `uploads.chunkBytes` | 64 MiB | the bytes of one upload request; keep it under the edge's body limit (Cloudflare: 100 MB on Free and Pro, 200 MB on Business) |
| `uploads.ttlSeconds` | 1 day | how long an upload session and its URL work (at most 7 days); `createUpload` may ask for less |
| `uploads.maxOpenPerOwner` | 5 | sessions one owner may have open at once (`files.too_many_uploads`) |
| `uploads.contentTypes` | `null` (any) | the media types an upload may declare, `video/mp4` or `video/*` (`files.content_type_not_allowed`) |
| `routes.links` | `/f` | the link route's prefix; mount the route under the same folder |
| `routes.uploads` | `/u` | the upload route's prefix; mount the route under the same folder |

Building a driver touches neither the disk nor the network, so `next build` runs without the folder or the bucket's
keys.

An S3-compatible bucket instead of the disk:

```ts
import { createS3Storage } from "@softure-ai/files/server";

files({
  storage: createS3Storage({
    endpoint: "https://<account>.r2.cloudflarestorage.com", // http://localhost:9000 for MinIO in development
    bucket: "app-files",
    region: "auto", // R2; the bucket's region elsewhere (MinIO and Garage default to us-east-1)
    prefix: "files/", // optional folder in the bucket
    // accessKeyIdEnv / secretAccessKeyEnv rename the two variables of §6.
  }),
});
```

A multipart upload left behind by a crashed process is aborted by the driver when it can; give the bucket a lifecycle
rule that aborts incomplete multipart uploads after a day for the rest.

## 4. Mounting

One route handler, the public links:

```ts
// app/f/[...link]/route.ts
export { serveFileLinkRoute as GET, serveFileLinkRoute as HEAD } from "@softure-ai/files/next";
```

**The route has no session and must stay reachable without one.** A link is protected by its signature, so:

- keep `/f` out of the app's own sign-in guard (`createAuthGuard(config, { protect: [...] })` of `@softure-ai/auth`
  guards only the prefixes it lists; do not list `/f` or `/`);
- behind an edge sign-in such as **Cloudflare Access** on every path, add a bypass for the prefix: with
  `@softure-ai/host`, `apps[].access.bypassPaths: [/f]` creates the Access application `<slug> bypass /f`; by hand,
  a second Access application for `<host>/f` with a Bypass policy for everyone;
- never cache it at the edge: the answer says `private, no-store`, and a cache rule that overrides origin headers
  must exclude `/f`.

Server code calls the functions with a context: `getFilesContext()` from `/next` in a route or action, or any
`{ db, clock, config }` in a worker.

```ts
import { getFilesContext } from "@softure-ai/files/next";
import { createFileLink, saveFile } from "@softure-ai/files/server";

const ctx = await getFilesContext();
const saved = await saveFile(ctx, { ownerId: user.id, path: renderedPath, name: "promo.mp4", contentType: "video/mp4", kind: "output", ttlSeconds: 7 * 86_400 });
if (!saved.ok) return saved; // files.too_large, files.quota_exceeded, files.invalid_input
const link = await createFileLink(ctx, saved.value.id, { ttlSeconds: 86_400 });
// link.value.url goes to the scheduler; link.value.expiresAt says until when it works.
```

A request body streams in directly: `saveFile(ctx, { ownerId, body: request.body, name, contentType })` (a web
`ReadableStream` is an async iterable in Node 22).

### 4.1 Uploads from clients

A second route handler takes uploads:

```ts
// app/u/[...upload]/route.ts
export { serveUploadRoute as GET, serveUploadRoute as HEAD, serveUploadRoute as PUT } from "@softure-ai/files/next";
```

Like `/f`, **the route has no session**: the URL carries an HMAC signature (under `SOFTURE_FILES_LINK_KEYS`, with its
own context, so an upload URL never passes as a link) and stops working once the session expires or is finalized. Keep
`/u` out of the app's sign-in guard, add an edge bypass for it as for `/f` (`apps[].access.bypassPaths: [/f, /u]` with
`@softure-ai/host`), and never cache it. Raise the edge's body limit only if you raise `uploads.chunkBytes`.

The app opens a session for a signed-in user and hands the URL to the client; the client sends the bytes; the app
finalizes:

```ts
import { createUpload, finalizeUpload } from "@softure-ai/files/server";

const created = await createUpload(ctx, { ownerId: user.id, name: "promo.mp4", contentType: "video/mp4", size, kind: "input" });
if (!created.ok) return created; // files.too_large, files.quota_exceeded, files.content_type_not_allowed, files.too_many_uploads, files.invalid_input
// ...the client uploads to created.value.uploadUrl...
const saved = await finalizeUpload(ctx, created.value.uploadId, { ownerId: user.id });
// saved.value is the StoredFile; files.upload_incomplete, files.checksum_mismatch, files.quota_exceeded otherwise
```

The wire protocol on `uploadUrl`:

| Request | Answer |
| --- | --- |
| `PUT` with `Content-Range: bytes <start>-<end>/<size>` | stores one chunk: `start` a multiple of `chunkSize`, `end` the chunk's last byte (the last chunk is shorter). `200` with the JSON status; a chunk that already arrived is answered without being rewritten, so a resend is safe. `416` for a range that is not one chunk, `400` for a body of another length, `404` once finalized or expired. |
| `PUT` without `Content-Range` | the whole file, when it fits one chunk |
| `HEAD` | `upload-state` (`open`, `complete`, `finalized`), `upload-size`, `upload-chunk-size`, `upload-received` (byte ranges, `0-67108863,134217728-201326591`), `upload-expires` |
| `GET` | the JSON status (`received`, `receivedBytes`, `missingChunks`, `state`, ...); a browser (`Accept: text/html`) gets the upload page instead |

The **upload page** is a small phone-friendly page on the same URL: the person picks the file and it is sent in chunks
with `fetch`, from the missing ones, so pressing Upload again resumes. Its copy is `filesMessages.en.uploadPage`; it
loads nothing external and runs one inline script under a per-response CSP nonce.

**Rate limit**: when the app enables `@softure-ai/security`, every request to the upload route counts in the
`files-upload` bucket, keyed by the session; spread `FILES_RATE_LIMIT_BUCKETS` (from `@softure-ai/files`) into
`security({ buckets })`, or the route throws a setup error naming it. Without the security module the route relies on
the signature alone.

Every chunk is its own object in storage (`uploads/<id>/<index>`); `finalizeUpload` streams them in order into
`saveFile`, which writes the one final object (a multipart upload on S3) and the parts are removed. Storage briefly
holds the file twice while a finalize runs. Two parallel finalizes keep one file; a second call answers the same file.

### 4.2 MCP upload tools

An MCP tool cannot take a video as an argument. With `@softure-ai/mcp-access`, register the two upload tools in the
app's server factory and list them in the catalog:

```ts
import { getFilesContext } from "@softure-ai/files/next";
import { FILE_UPLOAD_MCP_TOOLS, registerFileUploadTools } from "@softure-ai/files/mcp";

mcpAccess({ serverName: "acme", tools: [...appTools, ...FILE_UPLOAD_MCP_TOOLS] });

export const createServer = createMcpServerFactory({
  name: "acme",
  strictToolInput: true,
  registerTools: (server, identity) => {
    registerAppTools(server, identity);
    registerFileUploadTools(server, { identity, getContext: () => getFilesContext(), kind: "input" });
  },
});
```

- `create_upload({ name, size, content_type?, sha256? })` answers `upload_id`, `upload_url`, `chunk_size`,
  `chunk_count`, `expires_at`, `curl` (a bash loop with `dd` and `curl` that sends every chunk; `CHUNKS="3 4"` resends
  only those) and `browser_page`. The assistant runs the loop in its own sandbox; the bytes never pass through the tool
  call.
- `finalize_upload({ upload_id })` answers `file_id`, `name`, `size`, `content_type`, `sha256`, or the error's
  sentence with its code.
- Both are write tools: registered only when `identity.canWrite` (mcp-access's write switch). The uploads belong to the
  token's user (`getOwnerId` changes that). The app's tools then take the `file_id`.

An app that turns the uploaded file into its own record in the same call, or that words its tool texts its own way,
passes three more options:

```ts
registerFileUploadTools(server, {
  identity,
  getContext: () => getFilesContext(),
  // After every successful finalize, a repeated one for the same file included: keep it idempotent.
  onFinalized: async (file) => {
    const asset = await upsertAssetForFile(file.id); // the app's own step, e.g. a row plus a background job
    return asset.ok ? { asset_id: asset.value.id } : asset; // fields join the answer; err(code) answers a failure
  },
  descriptions: { finalize_upload: `Acme: ${FILE_UPLOAD_TOOL_DESCRIPTIONS.finalize_upload}` },
  hints: { "assets.quota_exceeded": "The plan holds no more assets." },
});
```

- `onFinalized(file, ctx)`: its returned fields are merged into the `finalize_upload` answer (the file's own fields
  win a name clash); a returned `err(code)` answers that code as a failure; a thrown error answers the generic failure
  and is logged.
- `descriptions`: the served text of `create_upload` and `finalize_upload`; the defaults are exported as
  `FILE_UPLOAD_TOOL_DESCRIPTIONS`. The catalog entries in `FILE_UPLOAD_MCP_TOOLS` stay as they are.
- `hints`: the text answered for an error code, followed by the code: the hook's codes and the package's `files.*`
  codes alike. Without a hint a `files.*` code answers its sentence and any other code answers the code alone.

## 5. Migrations and tables

Schema `files`, migration `0001_create_files.sql`, table `files`:

| Column | Meaning |
| --- | --- |
| `id` | uuid, made by `saveFile` (the storage key is derived from it: `ab/cd/<uuid>`) |
| `owner_id` | the owner's account id, 1 to 200 characters, no foreign key |
| `sha256`, `size` | lowercase hex SHA-256 and byte count of the content |
| `content_type` | a media type with optional parameters, type and subtype lowercased |
| `original_name` | the sanitised name: last path part, no control characters, at most 255 characters |
| `kind` | the app's category, `^[a-z][a-z0-9_-]{0,31}$`, `file` by default |
| `storage_key` | where the bytes are, unique |
| `link_generation` | bumped by `revokeFileLinks`; a link carries the generation it was made for |
| `expires_at`, `deleted_at`, `created_at` | a file is live while `deleted_at` is null and `expires_at` is null or ahead |

A deleted or expired file keeps its row until `pruneFiles` has removed its bytes. Rollback: drop the table and its
`softure.migrations` row (the migration's header has the statements); the objects in storage stay.

Migration `0002_create_uploads.sql`, table `uploads`: one row per upload session (owner, sanitised name, content type,
kind, declared size and optional SHA-256, chunk size, `received_chunks` (the indices that arrived), `file_id` once
finalized, `expires_at`). The state is derived from those columns. A finalized session keeps its row until it expires,
so a repeated finalize answers the same file; `pruneFiles` then removes it. Rollback: drop `files.uploads` and the
version 2 row; chunk objects under `uploads/` stay in storage.

## 6. Environment variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `SOFTURE_FILES_LINK_KEYS` | for links and uploads | the signing keyring, `<id>:<base64 of 32 bytes>[,<id>:<key>…]`: the first key signs, every key verifies. `generateFilesLinkKey()` (from `/server`) prints a new entry. Rotate by putting a new key first and dropping the old one after `links.maxTtlSeconds`. Without it, `createFileLink` answers `files.link_key_missing` and the route answers `404` (and logs the code). |
| `SOFTURE_FILES_S3_ACCESS_KEY_ID`, `SOFTURE_FILES_S3_SECRET_ACCESS_KEY` | with `createS3Storage` | the bucket's access keys, read on each request (renamed with `accessKeyIdEnv` / `secretAccessKeyEnv`) |

## 7. Switches

None.

## 8. Appearance

The upload page (§4.1) is plain HTML with a minimal inline style, so it works before any theme loads; an app that
wants its own look builds a page on `createUpload` and the same wire protocol. A file browser is out of scope.

## 9. Copy

`filesMessages.en.errors.files.*` has a sentence per error code (`too_large`, `quota_exceeded`, `not_found`, ...);
`getFilesErrorMessage(messages, code)` picks one, falling back to the generic failure. The link route's `404` body
is a fixed `Not found` for machines, not copy. `uploadPage.*` is the upload page's copy (`{name}`, `{size}`, `{done}`
and `{total}` are filled in).

## 10. Hooks

None. A driver is the extension point: any object with `kind`, `put(body, key)`, `get(key, range?)`, `head(key)`,
`delete(key)` and optionally `check()` (`FileStorage`) works.

## 11. GDPR

`exportUserData` lists the user's live files (id, name, kind, content type, size, SHA-256, created and expiry
times), never the bytes or the storage key; an app that wants the bytes in the export adds links itself.
`deleteUserData` marks every file of the user deleted (nothing of theirs is served from that moment), removes the
bytes from storage and then the rows; a file whose storage delete fails keeps its marked row until `pruneFiles`
removes it. Upload sessions too: the export lists the open ones (name, size, what arrived), the deletion removes all
of the user's sessions with their chunks.

## 12. Limitations

- Uploads from clients go through upload sessions (§4.1): chunks must align to the session's chunk size, and a
  finalize briefly needs twice the file's size in storage. No image transforms, no virus scanning, no file browser UI.
- A link serves one range per request; a request for several ranges gets the whole file (`200`), as RFC 9110 allows.
  No `If-Range` or `ETag`.
- Links are `attachment` with `nosniff` and a sandboxing `Content-Security-Policy` by default, so an uploaded HTML or
  SVG never runs on the app's origin; `inline` keeps those headers.
- The quota counts live files of one owner; it is not a global storage limit. Dedupe works per owner and only when
  enabled; two owners' copies of one file are two objects.
- The local driver needs one filesystem for the folder (the rename is atomic only there); the free-space check reads
  that filesystem. The S3 driver reports no free space.
- A storage key comes from the file id, not the hash: the hash is known only after the write, and S3 has no rename.

## Testing an app with it

```ts
import { createMemoryStorage, createTestLinkKeys, fetchFileLink, readFileLinkExpiry } from "@softure-ai/files/testing";

const storage = createMemoryStorage(); // files({ storage }); storage.objects(), setFailing(), setCheck()
const ctx = { db, clock, config, env: createTestLinkKeys() };
const answer = await fetchFileLink(ctx, link.url, { range: "bytes=0-99" }); // { status: 206, headers, body }
expect(readFileLinkExpiry(link.url)).toEqual(expectedExpiry);
```

`fetchFileLink` runs the same code as the route, at the context's clock, so advancing a test clock past the expiry
gives the `404`.

## Build

`npm run build -w modules/files` runs `tsc -p tsconfig.build.json`: ESM and `.d.ts` per source file in `dist/`.
Releasing: [scripts/release/README.md](../../scripts/release/README.md).
