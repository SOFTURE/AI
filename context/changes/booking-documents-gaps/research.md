# Research: booking-documents-gaps

## files

- `saveFile` (`modules/files/src/server/save.ts`) meters the body against `min(maxFileBytes, quota left)` and deletes
  the blob of any refused save; a non-size error from the body propagates.
- `downloadGuardedFile` (`modules/security/src/server/guarded-download.ts`, since 0.2.7) streams a 2xx body to
  `consume`, refuses a declared length over `maxBytes`, throws inside the body past it, and maps failures to
  `security.outbound_*` codes; `requireHttps` refuses plain http on every hop; ports outside `allowedPorts` are
  `security.outbound_blocked`. Its seam (`request`, `resolveHost`, `isAllowedAddress`) lets a test reach a loopback
  server while the guard runs.
- So: `saveFileFromUrl` = validate, pre-check https and port, `downloadGuardedFile` with `maxBytes = maxFileBytes`,
  `consume` = type check + `saveFile`; map codes. The upload's `isContentTypeAllowed` is reused for `contentTypes`.

## pwa

- `serviceWorker` (`modules/pwa/src/worker/service-worker.ts`) is one self-contained function; `fetch` answers extra
  origins first, then leaves excluded same-origin paths to the browser. Activate drops only `<app>-shell-*` and
  `<app>-pages-*`, so any other `<app>-<cache>` survives a new build (the extra-origin caches rely on that).
- `registerDeviceData({ caches })` deletes named caches on sign-out (`clearDeviceData`).
- So: a `keptFiles: { cache, pathPrefixes }` option, checked before the exclusion, answered cache first and never
  stored by the worker (the page fills it); a page helper `createKeptFiles({ app, cache, budgetBytes })` in
  `@softure-ai/pwa` (root, browser globals read at call time) with `sync(files)`, `find(url)`, `getUsage()`, and
  its cache registered through `registerDeviceData`. The SHA-256 rides on the cached response as a header, so a new
  hash replaces the copy; the downloaded bytes are checked against it.

## theme-notion

- Compositions live in `src/notion/*.tsx`, exported from `src/index.ts`, listed in the README, with a gallery case
  (`tests/gallery/cases.tsx`), the parity fixture (`tests/fixtures/notion-slots.json`), visual baselines and behaviour
  tests; `Dialog` and `Button` come from `src/ui`.
- PDF pages inside the page need a renderer: `pdfjs-dist` (Apache-2.0) renders each page to a canvas. It is loaded
  lazily (dynamic import) only when a PDF opens, and the engine is a prop so tests and apps can pass their own.
- So: `DocumentViewer` (a full-screen `Dialog`: title, page count, zoom out/in, close; PDF pages as canvases, an image
  as `<img>` from an object URL; a broken file shows an error) and `DocumentRow` (icon by type, title, size, an
  offline mark, a button that opens the document).
