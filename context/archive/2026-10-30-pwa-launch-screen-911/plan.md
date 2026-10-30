---
change_id: pwa-launch-screen-911
status: archived
---

# Plan: PWA launch screen (issue #911)

Input: change.md, research.md. Complexity: medium (two packages, a self-contained script, a worker rule).

## Phase 1: the worker keeps no streamed redirect or failed boundary (TDD)

Files: `modules/pwa/src/worker/service-worker.ts`, `modules/pwa/tests/service-worker.test.ts`.

- A navigation's 200 HTML is read before it is kept; HTML with `$RX=function(` or a `$RX(` call, or a
  `<meta http-equiv="refresh">`, is served but not kept, and the kept copy stays.
- Tests: a page with a streamed redirect and one with a failed boundary are served and not kept; an earlier kept
  copy survives; a plain page is still kept.

## Phase 2: the counter script and the copy (TDD)

Files: `modules/pwa/src/launch/launch-progress.ts`, `modules/pwa/src/launch/script.ts`, `src/index.ts`,
`src/messages/en.ts`, `tests/launch-progress.test.ts`, `tests/built-launch-progress.test.ts`.

- `launchProgress(page, config)`: self-contained; finds its root (`[data-slot="launch-screen"]`) from the running
  script; each tick computes paint share + finished assets share (`script[src]`, `link[rel~=stylesheet]`, Resource
  Timing `getEntriesByName` with `responseEnd > 0`) + time share (`1 - e^(-t/τ)`), capped at 99, never falling;
  writes `aria-valuenow`, `aria-valuetext`, `data-value`, the indicator's transform and the percent text; stops when
  the root left the document or reached 99.
- `buildLaunchProgressScript(options)`: shares and timing as options (defaults paint 10, assets 60, time 29,
  τ 4000 ms, tick 100 ms), checked (finite, not negative, sum at most 100, positive times).
- `pwaMessages.en.launch.label` ("Loading"): the progress bar's accessible name.

## Phase 3: `LaunchScreen` in theme-notion

Files: `themes/theme-notion/src/notion/LaunchScreen.tsx`, `src/index.ts`, `tests/notion/LaunchScreen.test.tsx`,
`tests/gallery/cases.tsx`, `tests/fixtures/notion-slots.json`, `visual/baselines/**`.

- Full-screen, theme background and foreground, icon (`iconSrc`, decorative), name, `Progress` at 0 with `label`,
  `0%` (hidden from screen readers), and the script when given.

## Phase 4: docs

pwa README (launch screen section, worker rule, copy, limitation: no startup images, client navigations), theme-notion
README, both `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- Split as research option 1; startup images left out (research option 3).
- Counter tests run the function against happy-dom markup and fake timers; the built-text test runs it alone.
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: worker rule
- [x] Phase 2: counter script and copy
- [x] Phase 3: LaunchScreen
- [x] Phase 4: docs
- [x] Implementation review
