# Plan: analytics-funnel

Input: change.md, research.md. Complexity: medium (2 phases). Risk: low.

## Goal

- Options `funnel: { steps: [{ id, via }], channelCap }`, route `funnel`, migration `0001_create_funnel_counts`,
  health check.
- `/server`: `recordFunnelStep`, `getFunnelReport`, `pruneFunnelCounts`, `formatDay`,
  `handleFunnelBeacon`, `handleFunnelPixel`.
- `/next`: `createFunnelRoute`, `<FunnelPixel>`, `<FunnelBeacon>`, `countRegistration`, `getAnalyticsContext`.
- `/client`: `createFunnelReporter`; `/ui`: the beacon's client component.
- Example: pixel on `/`, beacon on `/account`, `countRegistration("signup")`, the route, `e2e/analytics-funnel.spec.ts`;
  migrations, ops and container expectations list the analytics module.

## Approach

See research §2.

## Phase 1: Module

**Discipline:** TDD.

- Options, migration and schema, counter, report, prune, endpoint, client reporter, Next adapter, README.
- Tests (PGlite): counting, parallel counts, invalid channel, unknown step, day boundary in the zone, cap and
  overflow, known channels, report order, window and totals, prune, endpoint answers and refusals, 503 and its
  log line, the client reporter, `countRegistration` in a transaction and its failure policy.

## Phase 2: Example app, e2e, docs

- Config, pages, route, `e2e/analytics-funnel.spec.ts`, migrations/ops/container expectations, READMEs.
- Gaps found: FU-6 (the tag after a server action's redirect), FU-7 (a waitlist hook to count its sign-ups).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Module

#### Automated
- [ ] 1.1 Counter, report, endpoint, client and adapter tests pass
- [ ] 1.2 Module test passes; `module.json` equals the manifest
- [ ] 1.3 Gates green (typecheck, lint, test)

### Phase 2: Example app, e2e, docs

#### Automated
- [ ] 2.1 e2e `analytics-funnel.spec.ts` passes with the rest of the suite
- [ ] 2.2 Gates green (typecheck, lint, test, build)
