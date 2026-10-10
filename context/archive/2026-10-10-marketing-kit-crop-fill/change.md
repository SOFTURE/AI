---
change_id: marketing-kit-crop-fill
title: "marketing-kit: crop.fill and the flatten step for one row of a card (issue #371)"
status: archived
roadmap_item: null
issue: 371
branch: claude/project-thread-er5gw1
created: 2026-10-10
updated: 2026-10-10
archived_at: 2026-10-10
---

## Intent

Close [issue #371](https://github.com/SOFTURE/AI/issues/371): a `shots` entry that hides everything of a card but one
row leaves a card shorter than its fixed-aspect frame, so the page background and the next card fill the bottom of the
frame, and the list keeps a `border-top` that draws a stray line above the row.

1. `crop.fill: true` stretches a target shorter than its frame to the frame's bottom edge and centres its content.
2. A border above the first visible row can be removed for the capture only.
3. README "A still image of an interactive card" shows the case.

## Context

Issue #371 (labels `enhancement`, `pkg: marketing-kit`, `adoption`), follow-up to #333 (0.1.11, released). No roadmap
item; the PR closes the issue. Ships as 0.1.12.

## Constraints

- Scope: `tools/marketing-kit` only (config schema, screenshot capture, steps, tests, fixture, README, CHANGELOG,
  version, generated JSON schema).
- Keeps the kit's "no arbitrary CSS" stance: no per-entry style list.
- Browser behaviour is proven with a Playwright test against a static fixture.

## Process notes

- Research: skipped. The issue names the cause (card shorter than the frame, stray `border-top`) and two remedies;
  the code paths (`measureCrop`, `runShotSteps`) are small and read in full.
- Framing: skipped. The problem is observed by the adopting app and the issue's first proposal is taken.
