---
change_id: pwa-keeps-no-pages
title: "The service worker can keep no pages (maxPages: 0)"
status: archived
roadmap_item: null
branch: claude/project-thread-zldd5x
created: 2026-11-20
updated: 2026-11-20
archived_at: 2026-11-20
---

## Intent
An adopting app's pages are live server data (a queue of jobs whose state changes every minute). Its installed app
needs the worker's shell, offline page and new-build flow, but must never show an old copy of a page: offline it
shows the offline page. Today `maxPages` must be positive, so every visited page is kept and served when the network
fails or is slower than `navigationTimeoutMs`.

## Decisions (auto)
- `maxPages: 0` means "keep no page" instead of a new boolean: one option, no contradictory pair. The worker then
  never opens the pages cache, so a navigation is the network (up to `navigationMaxWaitMs`), else the offline page.
- `startPath` with `maxPages: 0` is refused when the route module loads: it would keep a page.
- Version: pwa 0.4.0 (minor: a new accepted value).

## Notes
- research and frame skipped: a two-line change of the worker's navigation with its cause read in the source
  (`checkPositiveInteger("maxPages", …)`, `keepPage` on every whole answer).

## Done
`maxPages: 0` keeps no page; tests lock the network answer, the offline page instead of an earlier answer, the slow
and the silent network, the shell still kept, and the refused options.
