---
change_id: pwa-device-data-874
status: archived
---

# Plan: clear device data on sign-out (issue #874)

Input: change.md, research.md. Complexity: medium (two packages, one new module each, docs).

## Phase 1: pwa device-data registry (TDD)

`modules/pwa/src/device-data.ts`, exported from the root entry; tests in `modules/pwa/tests/device-data.test.ts`.

- `registerDeviceData({ caches?, indexedDb?, storageKeys? })` → an `unregister()` function. `indexedDb` entries are
  `{ database, store? }`: a whole database, or one store of it. Names are checked (non-empty).
- `clearDeviceData(options?)` → `Promise<{ failed: readonly string[] }>`: the union of every registration (duplicates
  once), each part started at once and settled with `Promise.allSettled` (a part that throws synchronously is a
  failed part). Part names: `cache:<name>`, `indexedDb:<database>`, `indexedDb:<database>/<store>`,
  `storage:<key>`, `worker:clear-pages`.
- The worker message is always sent when a controller exists (the pages the worker kept), whatever is registered.
- Missing APIs skipped: no `caches`, no `indexedDB`, no `localStorage`, no controller. Dependencies are injectable
  (`{ caches, indexedDB, storage, serviceWorker }`), defaulting to the browser globals read at call time.
- IndexedDB: `deleteDatabase` with `blocked` as failure; one store cleared through `open` with the upgrade aborted
  for a missing database and a missing store skipped; the connection always closed.

## Phase 2: auth sign-out control

`modules/auth/src/ui/logout-form.tsx` (client), exported from `@softure-ai/auth/ui`; tests in
`modules/auth/tests/logout-form.test.tsx`.

- `LogoutForm({ action, messages, next?, beforeSignOut?, variant?, className? })`: a plain form posting to `action`
  (works without JavaScript). With `beforeSignOut`, the first submit is held, `beforeSignOut()` is awaited (a throw or
  rejection logged as `auth: before sign-out failed (<kind>)` via `errorLogLabel`), then the form is submitted again
  and the action runs. The button is disabled meanwhile, so a second click does not run it twice.
- `LogoutButton` (server, `@softure-ai/auth/next`) renders `LogoutForm` with `logoutAction` and the config's messages:
  one markup for both.

## Phase 3: docs

- pwa README: the registry and `clearDeviceData` (§1, §10), the sign-out recipe with `LogoutForm`, GDPR §11 (the
  device copy is personal data), limitations; CHANGELOG `## Unreleased`.
- auth README: `LogoutForm` and `beforeSignOut` with the pwa recipe; CHANGELOG `## Unreleased`.

## Decisions (auto)

- `clearDeviceData` in the root entry, as the issue names it: it touches browser globals only when called, so the
  entry stays safe to import on the server.
- The result is a value (`{ failed }`), not an exception: an expected failure, and the caller signs out anyway.
- `blocked` on database deletion counts as failed instead of waiting: a sign-out must not hang on another tab.
- `beforeSignOut` lives on a new client `LogoutForm` in `./ui` (a server component cannot carry a function), not on
  `logoutAction`: the action runs on the server, the device data is on the client.
- No timeout around `beforeSignOut`: the app owns its function; `clearDeviceData` itself never waits on a blocked
  database.
- No version bump: the coordinator releases.

## Progress

- [x] Phase 1: pwa registry and clear
- [x] Phase 2: auth LogoutForm with beforeSignOut
- [x] Phase 3: READMEs and CHANGELOGs
- [x] Implementation review
