---
change_id: testing-browser-hook-timeout
title: "Testing package browser tests start within a measured hook timeout"
status: implementing
roadmap_item: LT-3
branch: claude/lt-3-qp44k0
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

The browser tests of `@softure-ai/testing` start their server and Chromium within a hook timeout sized for a loaded
runner, so `npm test` (CI and the release gates) does not fail on a slow browser start.

## Context

From [`roadmap-later.md`](../../foundation/roadmaps/roadmap-later.md), item **LT-3** (prepared entry:
[`backlog-input.md`](backlog-input.md)):

> - **Outcome:** `foundation/testing/tests/playwright-browser.test.ts` starts its server and Chromium within a hook
>   timeout sized for a loaded runner (measured, with the measurement in a comment), so the release gates do not fail
>   on a slow browser start.
> - **Baseline:** the `testing@0.1.1` release (run 37444519206, 2026-10-06) failed its gates once with "Hook timed out
>   in 10000ms" at `playwright-browser.test.ts:91` and passed on one re-run.

Since then the same failure hit the `ci` workflow twice on PR #141 (runs 37512131054 and 37515421605). Taken on the
owner's word to clear the whole backlog by the morning of 2026-10-07, in parallel with LT-2 and the charts roadmap.

## Constraints

- Measure the hook before choosing the timeout; record the measurement in a comment.
- No retry and no skip of the test.
- Touches `vitest.config.mts` and `foundation/testing/tests/playwright-browser.test.ts` only; no published code
  changes, so no version bump.

## Notes

- Placement: the item lives in the queued `roadmap-later.md`, which holds no `in_progress`; it stays `ready` there
  until archived (precedent: LT-1).
- Framing skipped: the problem is a measured CI failure with one cause (a 10 s default hook limit), not a proposed
  solution in search of a problem; research found no cheaper or different reading.
