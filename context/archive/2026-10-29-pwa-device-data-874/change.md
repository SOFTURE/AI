---
change_id: pwa-device-data-874
title: "pwa, auth: clear what the device keeps on sign-out (issue #874)"
status: archived
roadmap_item: null
issue: 874
branch: claude/project-thread-wwgomk
created: 2026-10-29
updated: 2026-10-29
archived_at: 2026-10-29
---

## Intent

Close [issue #874](https://github.com/SOFTURE/AI/issues/874): an installable app that keeps user data on the device
(named caches, an IndexedDB database or store, `localStorage` keys, the pages the service worker kept) must leave
none of it behind after sign-out. Today every adopting app wires this by hand and replaces the auth package's
sign-out control to do it. `@softure-ai/pwa` gets a device-data registry and `clearDeviceData()`; `@softure-ai/auth`
gets a sign-out control with an optional `beforeSignOut` that runs before the sign-out action and never stops it.

## Context

Labels: `enhancement`, `pkg: auth`, `pkg: pwa`. Follow-up of #872 (merged in e1852f4). #873 extends the pwa exports
in parallel and merges first; master is merged in before READY. No release in this change: one batch release closes
the wave.

## Constraints

- Every part is cleared even when another fails; a part that throws at once counts as failed; the failed part names
  are returned. A missing API (no IndexedDB, no Cache Storage, no controlling worker) is skipped.
- The sign-out keeps working without JavaScript; `beforeSignOut` is awaited, its failure logged by kind only, and the
  sign-out goes on.
- English only in the repository; copy through message dictionaries.

## Notes

- Framing: skipped. The issue names the problem and the API.
