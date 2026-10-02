# @softure-ai/analytics

**Status:** wave 3 · not implemented · depends on: core, db, security

Acquisition channel tags (`?z=`, carried through the Referer and redirects) and a funnel counter
**without cookies and without PII**: daily aggregates `(day, channel, step)`, a cap on new channels per day,
`sendBeacon` and a GIF pixel. The report is a function.

**Tables:** `analytics.funnel_counts`

**Source in FIRE_TRACKER:** `src/lib/{channel-tag,funnel-steps,funnel-beacon}.ts`, `src/db/funnel-counts.ts`,
`src/app/actions/do-funnel.ts`, `src/app/kalkulator/licznik/route.ts`, part of `src/proxy.ts`, `scripts/kanaly-report*`.
Parametrized: the parameter name, funnel steps, endpoint and time zone.
