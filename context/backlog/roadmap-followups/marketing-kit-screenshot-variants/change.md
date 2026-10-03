---
change_id: marketing-kit-screenshot-variants
title: "Screenshots at a device scale and in both colour schemes"
status: backlog
roadmap_item: FU-18
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A project takes sharp, retina-scale marketing screenshots of its app, in the light and the dark scheme,
with one `softure-marketing shots` run.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-18** (roadmap `followups`, main since 2026-10-03):

> ### FU-18: Screenshots at a device scale and in both colour schemes
> - **Change ID:** `marketing-kit-screenshot-variants`
> - **Status:** proposed
> - **Outcome:** A `screenshots[]` entry can set a device scale (a retina capture for a store listing or a landing page) and capture the light and dark schemes in one run (`<id>-light.png`, `<id>-dark.png`), still behind the status, phrase and size gates.
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** Whether the size gate's 40 kB default should scale with the device scale.
> - **Risk:** LOW.
> - **Baseline:** marketing-kit MK-4 `mk-screenshots`: PNG at Playwright's default scale (1), one scheme per run (`app.colorScheme`). After: the schema takes `scale` and a scheme list, the tests cover both.
> - **PRD refs:** FR-25.
> - **Source:** `tools/marketing-kit/README.md` "Limitations"; `context/archive/2026-10-03-mk-screenshots/reviews/impl-review.md` F4

## Constraints

- Exclusively owns: `tools/marketing-kit/src/screenshot/` and the `screenshots` section of `src/config/schema.ts` (with the regenerated `schema/marketing.schema.json`).
- English-only code, comments and commits (AGENTS.md).
- No release, tag or publish by the agent; the owner tags releases.

## Notes
