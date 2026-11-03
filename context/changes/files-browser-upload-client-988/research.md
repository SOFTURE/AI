# Research: files-browser-upload-client-988

## Verified against master (a05cf4c)

- The gap is real. `@softure-ai/files` 0.2.0 exports `createUpload`, `getUpload`, `writeUploadChunk`,
  `finalizeUpload` and `serveUploadRoute`; nothing sends a browser `File`. The only chunk loop is the inline `SCRIPT`
  string in `src/server/upload-page.ts`, which reads the JSON status, sends `missingChunks` with `Content-Range` and
  shows progress, but cannot be imported.
- Wire protocol (`src/server/serve-upload.ts`): `HEAD` answers `upload-state`, `upload-size`, `upload-chunk-size`,
  `upload-received` (merged byte ranges `a-b,c-d`, empty when none) and `upload-expires`. `PUT` takes a chunk-aligned
  `Content-Range: bytes a-b/total` (`416` when not a chunk, `400` on a length mismatch), and every dead URL (forged,
  expired, finalized for `PUT`) answers `404`. With the security module on, `429` with `retry-after`.
- A finalized session still answers `HEAD`/`GET` (state `finalized`), so a resume after a finalize finds nothing to
  send. `finalizeUpload` is idempotent.
- theme-notion's `UploadFileItem` is `{ id, name, size, state, progress?, error? }` with states
  `queued | uploading | paused | done | failed`; the component is transport-free and the app wires `onRetry`,
  `onPause`, `onResume`, `onRemove`.
- `@softure-ai/files` has no React dependency; `@softure-ai/core`'s `Result` is a plain `{ ok, value | error }`
  object, so a browser entry can use its types without importing core at runtime.
- `@softure-ai/analytics/client` is the precedent for a browser entry in a module (`./client` export, no Node
  imports).
- Build target ES2023 (`tsconfig.base.json`): an `async function`'s `toString()` is its own source, without
  downlevel helpers, in both `dist/` and the Vitest transform. That lets the upload page inline the very same
  function, provided it references nothing outside its body.

## Options for the page reusing the sender

1. Inline `sendUpload.toString()` into the page's nonce script (chosen): one implementation, no new route or asset,
   the CSP stays as it is. Needs `sendUpload` self-contained; a test runs the inlined source on its own against the
   real route.
2. Serve the client as a script asset from `/u`: a second kind of answer on a signed route and a cache policy, for
   no gain.
3. Keep two loops: what the issue asks to end.

## Hook or controller

A React hook would add React as a peer of a server-first package. A framework-free controller with
`subscribe`/`getItems` plugs into `useSyncExternalStore` in one line, works outside React, and stays testable in
Node. Chosen: the controller, with the hook line in the README.
