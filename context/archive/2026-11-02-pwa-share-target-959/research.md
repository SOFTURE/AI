# Research: pwa-share-target-959

## Web Share Target (W3C draft, Chromium on Android)
- Manifest member `share_target: { action, method, enctype, params: { title, text, url, files: [{ name, accept }] } }`.
  `params` maps the share's roles to form field names. `method` is `GET` (default, urlencoded query) or `POST`;
  files need `POST` with `enctype: "multipart/form-data"`. `accept` lists MIME types (`image/*`) or extensions (`.pdf`).
- Chrome opens the action as a top-level navigation in the installed app's window, with the app's cookies.
- Many Android apps put the link in `text` (often "Look at this https://…"), and `url` stays empty: the link must be
  found in `text` as well.
- Safari (iOS, macOS) has no Web Share Target. iOS alternatives: paste from the clipboard in the app, or an iOS
  Shortcut that receives the share sheet's input and calls an app API with a token.

## Current code
- `modules/pwa/src/manifest.ts`: `buildManifest` returns a typed `WebAppManifest`; no `share_target`.
- `modules/pwa/src/next/routes.ts`: route factories return plain `Request -> Response` handlers; options are checked
  at module load (`resolveServiceWorkerConfig`), so a wrong option fails the build.
- `modules/pwa/src/worker/service-worker.ts:364`: the worker ignores non-GET requests, so a POST share always goes
  to the network. A GET share is a navigation: it is network-first and only a 200 HTML page is kept, so the share
  route's 303 is never kept.
- `modules/auth/src/proxy/index.ts:83`: auth's sign-in redirect carries the return path in `next` (path + query).
- `modules/files/src/server/save.ts`: `saveFile(ctx, { ownerId, name, contentType, body })`, `body` any
  `AsyncIterable<Uint8Array>`, metered chunk by chunk against `maxFileBytes` and the owner's quota.
- `foundation/testing/src/playwright/*`: helpers take a `Page`/`BrowserContext`; `tests/playwright-pwa.test.ts`
  drives a real Chromium against a small Node server (skipped without Chromium).

## Streaming multipart
`Request.formData()` buffers the whole body. A small streaming parser over `request.body` (a web
`ReadableStream`) is needed: read part headers (bounded), yield each part's body as an async iterable that stops at
the next `\r\n--boundary`, holding back only `delimiter.length` bytes.

## Options considered
- Depend on `@softure-ai/files` and `auth` from pwa: rejected, pwa would pull in the database and auth stacks; the
  app passes a streamed file to `saveFile` in one call.
- `request.formData()`: rejected, buffers whole files.
