# Plan: booking-documents-gaps

## Approach

Three independent phases, one per package, each with its tests, README and changelog entry; then one minor bump of
each package. TDD where the contract is clear (files, pwa), test-after for the viewer's rendering.

## Phases

### Phase 1: files `saveFileFromUrl` (#1257)
- `src/server/save-from-url.ts`, exported from `/server`; codes in `contract.ts` and `messages/en.ts`;
  `@softure-ai/security` range `^0.2.7`.
- Done when: `tests/save-from-url.test.ts` covers a saved file (name, type, hash), given name and type, gzip, a
  redirect, wildcard types; refusals: type (answered and given), http, other port, malformed, redirect to http,
  private and loopback addresses, metadata IP, 404, declared and streamed size over, exactly at the cap, quota,
  timeout, reset, invalid input, storage failure, dedupe.

### Phase 2: pwa kept files (#1255)
- `keptFiles` worker option (resolve + worker), `createKeptFiles` page helper.
- Done when: worker tests (cache first, under an excluded prefix, network when missing and not stored, survives a new
  build's activate, other paths untouched) and helper tests (download, budget in list order, replacement by a new
  `sha256`, a hash mismatch refused, removal of dropped entries, usage report, `find` as a Blob, sign-out clears it via
  `clearDeviceData`, a failed download reported).

### Phase 3: theme-notion `DocumentViewer` and `DocumentRow` (#1256)
- `src/notion/Document.tsx`, messages in `en.document`, `pdfjs-dist` as a dependency loaded lazily.
- Done when: behaviour tests with a fake engine (a three-page PDF shows three pages and "3 pages", zoom changes the
  scale within bounds, an image shows from a Blob, a broken file shows the error, a Blob opens with the network off,
  close calls `onOpenChange(false)`), a real `pdfjs-dist` render of a generated two-page PDF in Node, gallery cases,
  parity fixture, visual baselines, README.

### Phase 4: versions
- `files` 0.5.0, `pwa` 0.3.0, `theme-notion` 0.17.0 through `npm run release:version`.

## Progress

- [x] Phase 1 (df7f591): `npx vitest run modules/files` 234 passed; `tests/save-from-url.test.ts` 21 cases.
- [x] Phase 2 (22dc210): `npx vitest run modules/pwa` 318 passed; `kept-files-worker.test.ts`, `kept-files.test.ts`.
- [x] Phase 3 (19b61aa): `npx vitest run themes/theme-notion` 1216 passed; coverage 96.07 % statements, 93.91 % branches;
  `npm run test:visual -- --grep "inline cases|Document"` 8 passed (axe clean) with the new baselines, checked by eye.
- [x] Phase 4 (2f1cc03, c740f81, 03eac4e): files 0.5.0, pwa 0.3.0, theme-notion 0.17.0; `npm run build` exit 0.
