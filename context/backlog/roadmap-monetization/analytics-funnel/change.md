---
change_id: analytics-funnel
title: "Cookieless funnel counter"
status: backlog
roadmap_item: MO-5
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`analytics.funnel_counts` holding daily aggregates per (day, channel, step) with steps from config, a cap on new channels per day with an overflow bucket, a `sendBeacon` helper plus a POST beacon and GIF pixel endpoint with a body size limit, day boundaries in the configured time zone, and a report function returning the funnel per channel.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **MO-5** (roadmap `monetization`, main since 2026-10-03):

> ### MO-5: Cookieless funnel counter
> - **Change ID:** `analytics-funnel`
> - **Status:** ready
> - **Outcome:** `analytics.funnel_counts` holding daily aggregates per (day, channel, step) with steps from config, a cap on new channels per day with an overflow bucket, a `sendBeacon` helper plus a POST beacon and GIF pixel endpoint with a body size limit, day boundaries in the configured time zone, and a report function returning the funnel per channel.
> - **Prerequisites:** MO-4.
> - **Unknowns:** How the report reads other modules' counts (sign-ups, waitlist) without cross-schema coupling; retention of old aggregates.
> - **Risk:** low. No personal data is stored.
> - **Baseline:** FIRE counts its domain wizard steps with a report script. After: configurable steps counted in the example app, report covered by unit tests on PGlite.
> - **PRD refs:** FR-23, NFR-5.

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `modules/analytics/` funnel counter and endpoints, `modules/analytics/migrations/`, `examples/next-app/e2e/analytics-funnel.spec.ts`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
