---
change_id: observability-node-metrics-http-632
reviewed: 2026-10-21
verdict: approved
---

# Plan review: observability-node-metrics-http-632

Checked plan.md against change.md, research.md, issue #632, `config.ts`, `start.ts`, `next/index.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Every point of the issue maps to a step: metrics exporter with HTTP duration and runtime metrics and an off switch (Phase 1, 2), server spans honouring `ignorePaths` and `stableHttpAttributes` (Phase 2), both environment keys (Phase 1), a cardinality note (Phase 3). | No change. |
| 2 | Major | Server spans would record `url.query` with only AWS-style names redacted; the package's own rule is that a query can carry a token. | Query replaced by `REDACTED` through `startIncomingSpanHook`; tested in Phase 2. |
| 3 | Major | Next.js already creates a server span per request; HTTP instrumentation there would double them. | The adapter defaults `instrumentations.http` to `false`; tested. |
| 4 | Major | In ESM the app imports `node:http` before `startObservability`, and the patch would never apply (spike). | `createRequire` of `node:http`/`node:https` after registering; the test imports `node:http` first. |
| 5 | Minor | Health checks dropped only by the sampler would still count in the duration metric. | `ignoreIncomingRequestHook` with the same matcher. |
| 6 | Minor | New default export of metrics adds active series in apps that upgrade. | Minor version bump, CHANGELOG and README name the series and the off switches. |
| 7 | Check | `probeObservability` resolves the same config; the new `metrics` key does not change its result. | No change. |

No Critical findings.
