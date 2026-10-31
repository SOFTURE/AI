# Plan: pwa-offline-cold-start-924

## Approach
1. Options `startPath`, `navigationMaxWaitMs` (default 12 s, at least `navigationTimeoutMs`), `assetTimeoutMs`
   (default 10 s), checked in `resolveServiceWorkerConfig`.
2. `navigate`: race the network against the first timeout, then the kept page, then the network against the rest of the
   bound, then the offline page; the page is kept through a `waitUntil` registered at once.
3. `fetchBounded` for `fromShell` and `fromExtraOrigin`.
4. `keepShell` ends with `keepStartPage`, best effort.
5. Tests for each bound, a slow network inside it, the late page kept, the start page kept and refused, and the first
   cold start after a new build; README and changelog.

## Decisions (auto)
- D1 Defaults 12 s and 10 s: long enough for a slow mobile network, short enough that a silent one still opens.
- D2 `startPath` has no default: an app names its manifest's `start_url`; without it nothing changes.

## Progress
- [x] Phase 1: options and worker
- [x] Phase 2: tests, docs, gates
