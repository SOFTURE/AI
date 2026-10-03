---
change_id: analytics-funnel
title: "Cookieless funnel counter"
status: implemented
roadmap_item: MO-5
branch: claude/mo-5-analytics-funnel-ntufkm
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

`@softure-ai/analytics` counts a funnel without personal data: `analytics.funnel_counts` holds one
counter per (day, channel, step) with the steps from `analytics({ funnel: { steps } })`. A step is
counted by a pixel (`<FunnelPixel>`), a beacon (`<FunnelBeacon>`, `createFunnelReporter`) or only by
server code (`recordFunnelStep`, `countRegistration` for auth's `onRegistered`). The public endpoint
(`createFunnelRoute`: POST beacon, GET pixel, body at most 256 bytes) takes the channel from the page
the request came from. New channels past a daily cap count under an overflow key; the day is the
calendar day in the app's time zone; `getFunnelReport` returns the funnel per channel.

## Context

Input: [`backlog-input.md`](backlog-input.md) (roadmap item MO-5).

## Constraints

- Exclusively owns: `modules/analytics/` funnel counter and endpoints, `modules/analytics/migrations/`,
  `examples/next-app/e2e/analytics-funnel.spec.ts`.
- No personal data: no address, cookie, visit id or account in the table or in the beacon.
- Gaps go to the followups roadmap (owner, 2026-10-03), not into this change.
