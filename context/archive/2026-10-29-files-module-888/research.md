---
change_id: files-module-888
status: archived
---

# Research: files module (issue #888)

## What exists

- No package stores files. `@softure-ai/connections` is the closest shape: one Postgres schema, a keyring from one
  environment variable (`<id>:<base64 32 bytes>[,…]`, first key seals, every key opens), a route handler in `/next`,
  a privacy contributor, a health check, a `/testing` entry, PGlite tests (`createTestDatabase`).
- `@softure-ai/mcp-access` has the optional jobs adapter (`./jobs` entry, `@softure-ai/jobs` as an optional peer,
  `"jobs": "^0.1.1?"` in `dependsOn`) and a per-user `pg_advisory_xact_lock` around a count-then-insert.
- `@softure-ai/auth`'s proxy guard protects only the prefixes an app lists, so a link route outside them needs no
  change there. `@softure-ai/host` has `apps[].access.bypassPaths` for a Cloudflare Access bypass application per
  path: the edge sign-in bypass the link route needs.
- Core: `defineModule` (manifest routes, `mount` kinds `route-handler`, `page`, `middleware`), `PrivacyContributor`
  and `HealthCheck` both get the full `ModuleContext` (so the storage from the options is reachable).
- The repository tests count public packages (`tests/repo/release-tags.test.ts`); PR #882 raises it to 30, this
  package to 31.

## HTTP and storage facts that shape the design

- RFC 9110 ranges: a server may ignore a `Range` it does not support (several ranges) and answer `200` with the whole
  body; a syntactically invalid `Range` is ignored; a satisfiable single range gets `206` with `Content-Range: bytes
  a-b/size`; an unsatisfiable one `416` with `Content-Range: bytes */size`. `bytes=-n` is the last n bytes.
- `HEAD` answers the `GET` headers (`Content-Length` included) without a body.
- `Content-Disposition` with a non-ASCII name: `filename="<ascii fallback>"; filename*=UTF-8''<percent-encoded>`
  (RFC 6266 / RFC 8187).
- Serving user content from the app's origin: `X-Content-Type-Options: nosniff`, `Content-Security-Policy: sandbox`
  and `attachment` keep an uploaded HTML or SVG file from running script on the app's origin.
- S3 (and R2, MinIO, Garage) take path-style URLs (`<endpoint>/<bucket>/<key>`) signed with AWS Signature V4. A single
  `PUT` needs the length up front; an unknown-length stream goes up as a multipart upload (parts of at least 5 MiB
  except the last), which keeps memory to one part. S3 has no rename, so a key must be chosen before the content (and
  its hash) is known.
- Local disk: writing to a partial file in the target folder and `rename` into place is atomic on one filesystem;
  `fs.statfs` gives the free bytes for the health check (Node 22).
- AWS documents a SigV4 test vector (GET `/test.txt` with `Range: bytes=0-9`, signature `f0e8bdb8…bdb41`) that
  checks a signer without network access.
