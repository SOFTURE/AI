# @softure-ai/files

Stored files for a Next.js app that takes uploads or produces media (rendered videos, exports, reports), and public
links that hand one of them to a third party: a social media scheduler that fetches media from a URL, a mail with a
large download, a webhook consumer. The module keeps one table, puts the bytes on a storage driver (a folder on a
volume, or an S3-compatible bucket), and serves links that work without the app's session, serve byte ranges for
video and stop working after their time.

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
- **Retention**: `pruneFiles(ctx)` removes expired and deleted files from storage and the table; the `files.prune`
  job (`@softure-ai/files/jobs`) runs it hourly.
- **A privacy contributor** (the export lists the owner's files, the deletion removes them) and **a health check**
  (the table answers, storage takes a write, free space above `health.minFreeBytes`).
- **`/testing`**: an in-memory driver, a fixed link keyring, `fetchFileLink` (status, headers and bytes of a link,
  with a range or `HEAD`) and `readFileLinkExpiry`.

## 2. Installation

```bash
npm install @softure-ai/files
```

`@softure-ai/jobs` is an optional peer, needed only for the prune schedule.

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
| `routes.links` | `/f` | the link route's prefix; mount the route under the same folder |

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

## 6. Environment variables

| Variable | Required | Meaning |
| --- | --- | --- |
| `SOFTURE_FILES_LINK_KEYS` | for links | the signing keyring, `<id>:<base64 of 32 bytes>[,<id>:<key>…]`: the first key signs, every key verifies. `generateFilesLinkKey()` (from `/server`) prints a new entry. Rotate by putting a new key first and dropping the old one after `links.maxTtlSeconds`. Without it, `createFileLink` answers `files.link_key_missing` and the route answers `404` (and logs the code). |
| `SOFTURE_FILES_S3_ACCESS_KEY_ID`, `SOFTURE_FILES_S3_SECRET_ACCESS_KEY` | with `createS3Storage` | the bucket's access keys, read on each request (renamed with `accessKeyIdEnv` / `secretAccessKeyEnv`) |

## 7. Switches

None.

## 8. Appearance

None: the module has no UI. A file browser is out of scope.

## 9. Copy

`filesMessages.en.errors.files.*` has a sentence per error code (`too_large`, `quota_exceeded`, `not_found`, ...);
`getFilesErrorMessage(messages, code)` picks one, falling back to the generic failure. The link route's `404` body
is a fixed `Not found` for machines, not copy.

## 10. Hooks

None. A driver is the extension point: any object with `kind`, `put(body, key)`, `get(key, range?)`, `head(key)`,
`delete(key)` and optionally `check()` (`FileStorage`) works.

## 11. GDPR

`exportUserData` lists the user's live files (id, name, kind, content type, size, SHA-256, created and expiry
times), never the bytes or the storage key; an app that wants the bytes in the export adds links itself.
`deleteUserData` marks every file of the user deleted (nothing of theirs is served from that moment), removes the
bytes from storage and then the rows; a file whose storage delete fails keeps its marked row until `pruneFiles`
removes it.

## 12. Limitations

- No uploads from clients: no signed upload URLs, no chunked or resumable transfer. The app streams the request body
  into `saveFile` itself. No image transforms, no virus scanning, no file browser UI.
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
