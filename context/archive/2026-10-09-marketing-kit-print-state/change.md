---
change_id: marketing-kit-print-state
title: "marketing-kit 0.1.11: print state per shot, a crop anchored at another element, open and hide steps (issue #333)"
status: archived
roadmap_item: null
issue: 333
branch: claude/project-thread-etgfou
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close every point of [issue #333](https://github.com/SOFTURE/AI/issues/333), so an adopting app can replace its own
generator of signed-in landing-page frames with `softure-marketing shots`:

1. **Print state per entry.** An entry hides its own selectors (hint buttons, disclosure arrows, a `<summary>`), and
   a gate refuses the shot when one of them still shows inside the captured frame.
2. **Crop anchored at another element.** The frame takes its width from `crop.target` and its top edge from a second
   element (`crop.top`), e.g. a row inside the card.
3. **Expand all / trim a chart.** A step that opens every matching `<details>`, and a step that hides every match but
   the last N (the columns of a horizontally scrolling chart).

A reviewer checks the screenshot tests (hide gate, crop top, open and hide steps), the config tests, the README and
the CHANGELOG.

## Context

Issue #333, a follow-up to #253 (released in 0.1.10). Work is tracked in GitHub Issues: no roadmap item; the PR
closes the issue.

## Constraints

- Scope: `tools/marketing-kit` only. No other open branch touches it.
- A 0.1.10 `marketing.json` keeps working unchanged: every new key is optional.
- English-only code and docs.

## Notes

- Research: skipped as a separate file. The issue names the three gaps and the code involved is small
  (`src/screenshot/*`, `src/config/shot-steps.ts`, `src/config/schema.ts`); the findings are in plan.md's "Today".
- Framing: skipped. Each point is an observed adoption gap with a proposal in the issue.
