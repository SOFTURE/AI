---
change_id: pwa-manifest-icon-origin-920
title: "pwa: manifest id and dir, icon glyph scale, extra-origin strategies (issue #920)"
status: in_progress
roadmap_item: null
issue: 920
branch: claude/project-thread-cglf9s
created: 2026-11-01
updated: 2026-11-01
---

## Intent
#920 (`enhancement`, `pkg: pwa`): an adopting installable app moved onto `@softure-ai/pwa` 0.1.3, but three parts had
to stay in the app. The package should let it keep its installed identity (manifest `id`, `dir`), draw its mark at its
own glyph scale through `createIconRoute`, and serve an offline map's origin the way a map needs (normalized cache keys
for a pre-downloaded area, network first with a timeout for style files, nothing stored while browsing).

## Context
`modules/pwa/src/manifest.ts` (`buildManifest`), `src/next/routes.ts` (`createIconRoute`), `src/worker/source.ts`
(`ExtraOriginOptions`, `resolveServiceWorkerConfig`) and `src/worker/service-worker.ts` (`fromExtraOrigin`).
theme-kit's `drawAppIcon` already takes `glyphScale` (#854).

## Constraints
- Defaults keep today's behaviour: `id` is `startUrl`, the kit's glyph scales, extra origins cache first and stored.
- The worker stays one self-contained function: every new option is JSON data it applies without imports.
- No change to the adopting app's repository.

## Notes
- Framing skipped: the issue names the three gaps, the proposal and the acceptance checks.

## Done
