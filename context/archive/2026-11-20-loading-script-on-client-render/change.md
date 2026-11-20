---
change_id: loading-script-on-client-render
title: "Loading states draw their counter script only in the server's HTML"
status: archived
roadmap_item: null
branch: claude/project-thread-xuxr1x
created: 2026-11-20
updated: 2026-11-20
archived_at: 2026-11-20
---

## Intent
An adopting app streams `RouteLoading` from its root `app/loading.tsx`. On every client-side navigation into a new
segment React renders the loading states on the client, creates their inline `<script>` and logs in development
"Encountered a script tag while rendering React component". The app's e2e that fail on any console error went red.
The script should exist only where the browser runs it: the server's HTML.

## Decisions (auto)
- A small client component, `StreamedScript`, renders the script with `useSyncExternalStore`: the server snapshot
  (`true`) keeps it in the server's HTML and through hydration, the client snapshot (`false`) drops it after
  hydration and draws nothing on a client-only render. No `typeof window` check, so hydration never mismatches.
- The same component in `@softure-ai/ui` (`streamed-script.tsx`) and in theme-notion (`StreamedScript.tsx`):
  theme-notion takes ui as a dev dependency only, so it cannot import it at runtime.
- Versions: theme-notion 0.29.1, ui 0.3.11 (patch: no API change).

## Notes
- research and frame skipped: a two-file fix of a reported warning with its cause found in React's source
  (`createInstance` warns for a `script` it creates unless it is a data block).

## Done
`LaunchScreen` and `TopLoadingBar` (theme-notion, ui) draw the counter through `StreamedScript`; tests lock the
server HTML, a warning-free hydration and a script-free, warning-free client render.
