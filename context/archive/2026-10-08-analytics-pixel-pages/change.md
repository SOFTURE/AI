---
change_id: analytics-pixel-pages
title: "analytics: a pixel step names its pages (issue #235)"
status: archived
roadmap_item: null
issue: 235
branch: claude/analytics-pixel-referer-hey7pg
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Let a `pixel` step of `@softure-ai/analytics` name the pages it sits on (`pages`), and have the public funnel
endpoint count a pixel only when its `Referer` is one of them. Today the endpoint checks only that the `Referer`
is a first-party page, so a pixel image loaded while another page is open (the framework's prefetch of a link to
the landing page) counts the landing step under the other page's channel
([#235](https://github.com/SOFTURE/AI/issues/235)).

A reviewer checks the new tests in `modules/analytics/tests/`, the option rule, the README warning, the CHANGELOG
and the version bump (analytics 0.1.9).

## Context

- `handleFunnelPixel` → `countPixel` → `readVisit` (first-party `Referer`, `Sec-Fetch-Site`) → `countStep`
  (step from the query, `findPublicStep` checks only the id and `via`). Nothing compares the page with the step.
- Step options live in `src/options.ts` (`stepSchema`, a zod strict object `{ id, via }`); hooks that are
  functions (`channelFromReferer`, `isKnownChannel`) are validated with `z.custom`.
- Steps never reach the browser (only `getChannelRule` and the step field do), so a function in a step is safe.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Backward compatible: `pages` is optional; without it a pixel counts as before. The README warns about prefetch.
- An ignored pixel gets the same 200 GIF as a counted one (no oracle, the endpoint's rule).
- Only `@softure-ai/analytics` changes. Bumps it 0.1.8 → 0.1.9; the thread releases it after the merge.

## Process notes

- Research: skipped as a separate artefact. The issue names the code path (`readVisit` / `countPixel`), the whole
  endpoint is one 107-line file, and the reading fits in `plan.md` § Findings.
- Framing: skipped. The cause is shown by the repro (a first-party `Referer` that is not the pixel's page), and
  the fix the issue proposes is the only one that holds whatever the browser's reason for loading the image
  (prefetch, prerender, a cached RSC payload). The alternative of dropping `Sec-Purpose: prefetch` requests was
  weighed in the plan and rejected (D3).
