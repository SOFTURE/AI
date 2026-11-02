---
change_id: pwa-share-target-959
title: "pwa: the installed app is a Web Share Target (issue #959)"
status: plan_reviewed
roadmap_item: null
issue: 959
branch: claude/project-thread-u1t14t
created: 2026-11-02
updated: 2026-11-02
archived_at: null
---

## Intent
An installed app on Android appears in the system share sheet. A shared link, text or file reaches an app action
(`handle`), which answers where to go next; a signed-out user goes to the sign-in page and comes back with the shared
link and text. Files stream through and are never buffered whole, so the app can hand them to `saveFile` of
`@softure-ai/files`. A Playwright helper posts a share like the system does.

## Context
#959 (`enhancement`, `pkg: pwa`). `@softure-ai/pwa` 0.1.4 builds the manifest (`buildManifest`,
`createManifestRoute`) and the service worker; it has no `share_target`. `@softure-ai/files` 0.1.2 `saveFile` takes a
streamed body with its own size cap and per-owner quota. `@softure-ai/testing` 0.4.1 has the installed-app helpers.
#960 (theme components for pwa) also edits `modules/pwa/README.md`: expect a README merge.

## Constraints
- Owns `modules/pwa/src/share/`, `modules/pwa/src/next/share-target-route.ts`, `modules/pwa/src/manifest.ts`,
  the pwa README/CHANGELOG, `foundation/testing/src/playwright/share.ts` and its export, tests in both packages.
- No new dependency of `@softure-ai/pwa` on `files` or `auth` (pwa depends only on `core`).
- No version bump (the coordinator releases in a batch). No change to any adopting app.

## Notes
- Framing skipped: the issue states the gap and a concrete proposal.
