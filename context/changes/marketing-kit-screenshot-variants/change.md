---
change_id: marketing-kit-screenshot-variants
title: "Screenshots at a device scale and in both colour schemes"
status: implementing
roadmap_item: FU-18
branch: claude/fu-18-bnv06i
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

A project takes sharp, retina-scale marketing screenshots of its app, in the light and the dark scheme, with one
`softure-marketing shots` run. A `screenshots[]` entry sets a device `scale` and a list of `colorSchemes`; every file
it produces still passes the status, phrase and size gates on its own. An entry without the new keys produces the
same single `<id>.png` as today.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-18** (roadmap `followups`, main since 2026-10-03):

> ### FU-18: Screenshots at a device scale and in both colour schemes
> - **Outcome:** A `screenshots[]` entry can set a device scale (a retina capture for a store listing or a landing page) and capture the light and dark schemes in one run (`<id>-light.png`, `<id>-dark.png`), still behind the status, phrase and size gates.
> - **Unknowns:** Whether the size gate's 40 kB default should scale with the device scale.
> - **Risk:** LOW.
> - **Baseline:** marketing-kit MK-4 `mk-screenshots`: PNG at Playwright's default scale (1), one scheme per run (`app.colorScheme`). After: the schema takes `scale` and a scheme list, the tests cover both.

The gap is F4 of the MK-4 implementation review (`context/archive/2026-10-03-mk-screenshots/reviews/impl-review.md`)
and the README "Limitations" line. The backlog entry this change was opened from is [`backlog-input.md`](backlog-input.md).

## Constraints

- Exclusively owns: `tools/marketing-kit/src/screenshot/`, the `screenshots` section of
  `tools/marketing-kit/src/config/schema.ts` and the regenerated `schema/marketing.schema.json`.
- Lane E (roadmap Order): FU-19 adds keys to the same `schema.ts` after this change; this change must not do its work.
- Every new schema key carries a `.describe()` (`tests/schema.test.ts`).
- English-only code, comments and commits (AGENTS.md). No release, tag or publish by the agent; the owner tags releases.

## Notes

- Placement: roadmap `followups`, item FU-18 (taken from `context/backlog/roadmap-followups/`).
- Research: done (quick depth); it answers the roadmap Unknown (the size gate) from the code and Playwright's API.
- Framing skipped: the problem is settled (MK-4 frame.md option C deferred exactly this, and the roadmap names the
  outcome and the file names); the open points are key names and the size-gate default, which research answers.
