---
change_id: pwa-share-target-959
title: "pwa: the installed app is a Web Share Target (issue #959)"
status: archived
roadmap_item: null
issue: 959
branch: claude/project-thread-u1t14t
created: 2026-11-02
updated: 2026-11-02
archived_at: 2026-11-02
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

## Done
- `shareTarget` in `buildManifest` / `createManifestRoute` writes `share_target` (GET for text, POST multipart with
  files); the options are checked when the route module loads.
- `createShareTargetRoute` (`/next`): `GET` and `POST`, the first http(s) link from `url` or `text`, files streamed
  part by part through `readMultipart` (accepted types and declared fields only, at most `maxFiles`), 303 to the path
  `handle` answers, 400/413/415 refusals, the sign-in round trip with the link and text kept in `next`.
- `shareToApp` in `@softure-ai/testing/playwright`, tested in Chromium.
- README (pwa §1, §3, §4 "Share target" with iOS fallbacks, §12; testing's table) and both changelogs (Unreleased).
- Left out (D3): the offline replay of a POST share in the service worker (optional in the issue); listed under
  limitations.
- Release: next pwa and testing releases (batched by the coordinator).
