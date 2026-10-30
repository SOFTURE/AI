---
change_id: pwa-launch-screen-911
title: "pwa: a launch screen with the app icon and a progress counter, and no kept streamed redirects (issue #911)"
status: archived
archived_at: 2026-10-30
roadmap_item: null
issue: [911]
branch: claude/project-thread-ozwq4p
created: 2026-10-30
updated: 2026-10-30
---

## Intent

Close [issue #911](https://github.com/SOFTURE/AI/issues/911): an installed app whose pages render per request shows
a blank screen until the first page arrives. Give apps a launch screen to stream at once from `app/loading.tsx`: the
app's icon, its name, a progress bar and a percentage counter moved by an inline script. Stop the service worker from
keeping a page whose streamed HTML is a sign-in redirect or a failed boundary.

## Context

Labels: `pkg: pwa`. The pwa package draws nothing on the page: its visible parts are theme components
(`UpdatePrompt`, `InstallBar` in theme-notion) fed with the package's copy. Independent of the open marketing-kit
work (#898, #899) and the deploy work (#905). No version bump: both packages join the batched release of the wave.

## Constraints

- Backwards compatible: new exports and props only; the worker keeps every page it kept before except streamed
  redirects and failed boundaries.
- The counter script is self-contained (it runs from its text), like the worker.

## Notes

- Framing: skipped. The issue names the parts, the behaviour and the worker rule.
