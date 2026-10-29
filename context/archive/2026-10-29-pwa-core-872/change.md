---
change_id: pwa-core-872
title: "pwa: a new package for installable apps: manifest, icons, service worker, new-build update flow (issue #872)"
status: archived
roadmap_item: null
issue: 872
branch: claude/project-thread-ipzblo
created: 2026-10-29
updated: 2026-10-29
archived_at: 2026-10-29
---

## Intent

Close [issue #872](https://github.com/SOFTURE/AI/issues/872): no SOFTURE package makes an app installable and usable
offline, and an adopting Next.js app wrote that layer itself (about 1,500 lines). A new package `@softure-ai/pwa`
gives every app the generic part: one public `/pwa/` prefix, the web app manifest from the theme's token values and
the app's copy, the icon registry and its route on theme-kit's `drawAppIcon`, a service worker served from a route
and generated from one Node-testable function, the new-build update flow on the page, the build version, and
`useIsOnline()`. theme-notion gets the update prompt in its look.

## Context

Labels: `enhancement`, `pkg: pwa`. Follow-ups filed separately: install offer (#873), clearing the device on sign-out
(#874), Playwright helpers (#875). The theme-notion part touches the files of #871 (PR #879, in flight): it lands after
#879 merges. No release in this change: one batch release closes the wave.

## Constraints

- Starts from `templates/package/`; passes the workspace package rules (`tests/repo/packages.test.ts`).
- The worker is one self-contained function plus a JSON config, unit-tested in Node with a fake scope; the build id
  changes the served bytes.
- No worker under `next dev`; a failed registration is reported and the app keeps working.
- English only in the repository; copy through message dictionaries.

## Notes

- Framing: skipped. The issue names the problem, the reference implementation and the API.
