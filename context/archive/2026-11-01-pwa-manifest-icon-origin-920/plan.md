# Plan: pwa-manifest-icon-origin-920

## Approach
1. Manifest: `ManifestOptions.id` (default `startUrl`) and `dir` (`ltr` | `rtl` | `auto`, written only when set).
2. Icons: `IconRouteOptions.glyphScale`, a number for the `rounded` and `square` shapes or a per-shape record
   (`maskable` only when named), forwarded to `drawAppIcon`.
3. Extra origins (options, checked in `resolveServiceWorkerConfig`, JSON in the worker config):
   - `pathPrefixes` limits an entry to some paths; entries are tried in order, the first match wins;
   - `strategy`: `"cache-first"` (default) or `"network-first"` with `timeoutMs` (default 5 s): the network within the
     timeout, else the kept copy, else the network up to `assetTimeoutMs`; a non-ok answer yields to a kept copy;
   - `cacheKey: { pattern, replacement }`: a regular expression applied to the path; the key is
     `origin + path.replace(pattern, replacement) + search`, used for lookups and puts;
   - `store: false` never stores what the worker fetches (the page fills the cache);
   - `getExtraOriginCacheKey(url, cacheKey)` and `getExtraOriginCacheName(app, cache)` exported from `/worker` so the
     page writes under the keys the worker reads.
4. Tests: manifest id/dir, icon route glyph scale per shape (kit mocked), worker strategies (normalized keys from a
   newer build, network first within and past the timeout, `store: false`, path filters), config checks, built worker.
5. README and CHANGELOG (Unreleased).

## Decisions (auto)
- D1 `cacheKey` is a regular expression and a replacement string, not a segment list: JSON, applied with the
  worker's own `RegExp`, and covers dropping a build segment as well as other host quirks. Checked at build time.
- D2 A number `glyphScale` skips `maskable`, as the issue asks; the maskable scale is set only by name.
- D3 `timeoutMs` is refused with `cache-first`, so a wrong option fails the build instead of being ignored.
- D4 No release in this change: the coordinator releases in a batch.

## Progress
- [x] Phase 1: manifest and icon route (26ca70d)
- [x] Phase 2: extra-origin strategies (11f613c)
- [x] Phase 3: tests, docs, gates (ef75803)
