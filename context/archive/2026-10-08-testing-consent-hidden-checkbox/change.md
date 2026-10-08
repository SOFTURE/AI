---
change_id: testing-consent-hidden-checkbox
title: "testing: tick the consent box on a visually hidden checkbox (issue #245)"
status: archived
roadmap_item: null
issue: 245
branch: claude/project-thread-aocb9y
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

`registerAccount` of `@softure-ai/testing/playwright` ticks the consent box with `locator.check()`. On a checkbox
built as a visually hidden native input under a custom box (`sr-only` or `opacity-0`), Playwright refuses the click
because another element "intercepts pointer events", so an adopting app cannot move its sign-in helper onto the
package ([#245](https://github.com/SOFTURE/AI/issues/245)). After this change the helper ticks such a checkbox,
asserts it is checked, and the same tick is exported for an app's own forms.

## Context

- The only `.check()` in the helpers is `src/playwright/auth.ts:37`.
- `@softure-ai/ui`'s `Checkbox` draws a frame over an `opacity-0` input; an app may instead clip the input
  (`sr-only`) and draw the box in the label, which is the case Playwright refuses.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Backward compatible: markup that worked with `.check()` keeps working.
- Only `@softure-ai/testing` changes; version 0.1.2 → 0.1.3. Not released by this change: issue #251 also changes
  testing and its thread releases the package once.

## Process notes

- Research: skipped as a separate artefact. The issue names the line, the helper file is 60 lines, and the reading
  fits in `plan.md` § Findings.
- Framing: skipped. The issue reports a reproducible failure with its cause and proposes fixes in the same helper;
  there is no competing explanation to weigh, only which tick to use (decided in the plan).
