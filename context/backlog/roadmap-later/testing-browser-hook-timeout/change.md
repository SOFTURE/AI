---
change_id: testing-browser-hook-timeout
title: "Testing package browser tests start within a measured hook timeout"
status: backlog
roadmap_item: LT-3
branch: null
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

The browser tests of `@softure-ai/testing` start their server and Chromium within a hook timeout sized for a loaded
runner, so the release gates do not fail on a slow browser start.

## Context

From [`roadmap-later.md`](../../../foundation/roadmaps/roadmap-later.md), item **LT-3**: the `testing@0.1.1` release
(run 37444519206, 2026-10-06) failed its gates once with "Hook timed out in 10000ms" at
`foundation/testing/tests/playwright-browser.test.ts:91` and passed on one re-run. `vitest.config.mts` raises
`testTimeout` to 60 s but leaves `hookTimeout` at Vitest's default of 10 s.

## Constraints

- Measure the hook on a loaded machine before choosing the timeout; record the measurement in a comment.
- No retry and no skip of the test.
