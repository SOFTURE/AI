---
change_id: pwa-core-872
status: archived
---

# Plan: the pwa package (issue #872)

Input: change.md, research.md. Complexity: large (new package, five entries' worth of behaviour, one theme part).

## Phase 1: package skeleton

Copy `templates/package/` to `modules/pwa/` (`@softure-ai/pwa`, id `pwa`): exports `.`, `/next`, `/worker`,
`/react`; peers `next` ^16, `react` ^19, `@softure-ai/theme-kit` ^0.1.7 (also dev); `module.json` mounts; messages
`pwaMessages.en` (update prompt copy); README with the twelve sections; CHANGELOG `## Unreleased`.

## Phase 2: manifest, icons, build version (TDD)

- `src/icons.ts`: `PWA_PREFIX` (`/pwa`), the icon registry (`icon-32.png`, `apple-icon-180.png`, `icon-192.png`,
  `icon-512.png`, `icon-maskable-512.png`: size, shape, purpose), `getIconMetadata()` for the head's `<link>`s.
- `src/manifest.ts`: `buildManifest({ theme, copy, lang, startUrl, scope, display })` from token values.
- `src/next/`: `createManifestRoute` (`application/manifest+json`), `createIconRoute` (`GET` + `generateStaticParams`,
  404 outside the registry), `createVersionRoute`, `getBuildVersion` (`.next/BUILD_ID` once per process, `dev`).

## Phase 3: the service worker (TDD)

- `src/worker/service-worker.ts`: one self-contained function `(scope, config)`: build-named caches, install keeps
  the offline page and the same-origin scripts, styles and icons its HTML names; activate drops the app's caches of
  other builds and claims; navigations network first with a timeout, then the kept page, then the offline page, LRU
  cap; static prefixes cache first; only whole same-origin answers kept; excluded prefixes untouched; extra origins
  cache first in their own cache; messages `skip-waiting`, `clear-pages`.
- `buildServiceWorkerSource(config)`; `createServiceWorkerRoute` serves it at `/sw.js` (`no-cache`,
  `Service-Worker-Allowed: /`).
- Tests on a fake scope (caches, clients, fetch, events) in Node; the built `dist/` source evaluated too.

## Phase 4: the page side (TDD)

`src/react/`: `watchServiceWorker` (headless, injected container, document, reload), `useServiceWorkerUpdate`,
`useIsOnline`; happy-dom tests for the update flow (no reload on the first install, reload only after `activate`,
`update()` on return to the foreground, no registration in development, a failed registration reported).

## Phase 5: theme-notion `UpdatePrompt` (after #879 merges)

A floating `Alert` with a reload `Button`, safe-area aware, copy as props; export, README, gallery case, parity
fixture, visual baselines, CHANGELOG.

## Phase 6: docs

Package README (access-proxy bypass of `/pwa/`, Traefik notes, the offline page, mounting), root README layout line.

## Decisions (auto)

- A module under `modules/pwa` without `defineModule` options: the factories take their options, so an app without
  `softure.config.ts` uses it too.
- Icon names carry `.png` (`/pwa/icons/icon-192.png`): a CDN and the installer see an image path.
- `excludedPrefixes` replaces the default list (`DEFAULT_EXCLUDED_PREFIXES` is exported to extend); the worker's own
  path is always excluded.
- `theme_color` and `background_color` both default to the `background` token (light); options pick other roles.
- A failed `registration.update()` on return to the foreground is ignored on purpose (offline is the usual cause);
  a failed registration goes to `onError`.
- The prompt lives in theme-notion; the pwa package ships its English copy.
- The package defines `pwa` with `defineModule` (no options): the release tooling bumps an inline manifest in every
  module's `src/index.ts`.
- Package version 0.0.0 with `## Unreleased`: the batch release sets its first version.
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: package skeleton, 02d9a08
- [x] Phase 2: manifest, icons, build version, 02d9a08
- [x] Phase 3: the service worker, 02d9a08
- [x] Phase 4: the page side, 02d9a08
- [x] Phase 5: theme-notion UpdatePrompt, 7f4eb98 (an isolated gallery case: no shared file with #879 beyond the
  export list, CHANGELOG and fixture)
- [x] Phase 6: docs, 02d9a08
- [x] Implementation review: approved
