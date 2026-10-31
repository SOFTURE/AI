---
change_id: pwa-offline-cold-start-924
title: "pwa: an installed app starts offline on a silent network and after a deploy"
status: archived
issue: 924
branch: claude/project-thread-db8v02
created: 2026-10-31
updated: 2026-10-31
---

## Intent
#924: an adopting app's installed PWA did not open where the phone had a connection that carried no data. The
worker waited for that network without limit whenever no page was kept, and none was kept after every deploy, because
a new build's activation drops the old build's pages.

## Context
`modules/pwa/src/worker/service-worker.ts` (`navigate`, `fromShell`, `fromExtraOrigin`, `keepShell`) and its options
in `source.ts`. The adopting app reproduced it on a production build with a persistent Chromium profile and a proxy
that accepts connections and never answers.

## Constraints
- A failing network still falls back at once; a working network still serves fresh pages.
- The install still fails when the offline page fails; nothing changes for an app that sets no `startPath`, except
  the bounds.

## Notes
- Framing and research skipped: the issue carries the measurement and the cause.
- The owner asked the adopting app's session to make this change in the package directly and release it (2026-10-31).

## Done
- `navigationMaxWaitMs` (12 s): with no kept page a navigation answers the offline page at the bound; the late page is
  kept through a `waitUntil` registered while the event is open.
- `assetTimeoutMs` (10 s): a shell or extra-origin file not kept fails at the bound instead of hanging.
- `startPath`: the start page and the files it names are kept at install in the new build's caches, best effort.
- Tests: `tests/service-worker.test.ts` ("on a silent network", "start page", config checks), `tests/built-worker.test.ts`.
- Release: `pwa@0.1.4`.
